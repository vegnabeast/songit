var express = require('express');
var path = require('path');
var router = express.Router();
var fs = require('fs-extra');

//Set up Watson Text-Speech Module
var TextToSpeechV1 = require('watson-developer-cloud/text-to-speech/v1');
var speech = new TextToSpeechV1({
    username: 'a2a45da1-2b28-468f-8491-f33fd2689862',
    password: 'pbUa1Krxp1tB'
});

//Set up the Sox modules
var soxCommand = require('sox-audio');

//Set up the syllable counter
var syllable = require('syllable');




router.get('/', function (appReq, appRes) {
    if(appReq.query.name == null && appReq.query.download == null){//Serve the Home page if no query is set
        console.log("INDEX");
        gatherSongList(function(songList) {
            appRes.render('index', {songs: songList.songs});
            appRes.end();
        });
    }else{ //Serve the search page after main calls back

        //The user has entered a name and chosen a song
        if(appReq.query.song) {
            console.log("starting search with: " + appReq.query.name);
            main(appReq.query.name.toLowerCase(), appReq.query.song, function(file){
                if(!file){
                    console.log('ERROR: THIS IS DUMB');
                    appRes.render('error');
                    appRes.end();
                }else{
                    console.log('file location: ' + file);
                    appRes.render('search', {fileLocation: JSON.stringify(file)});
                    appRes.end();
                }

            });
            //If the user requests to download the song
        }else if(appReq.query.download) {
            console.log("DOWNLOADING");
            appRes.download(appReq.query.download);
        }else{
            console.log("INDEX");
            appRes.render('index');
            appRes.end();
        }
    }
});

function main(name, song, callback){

    createNameAudio(name, function(nameFile){
        createFinalSong(nameFile, name, song, function(finalFile){
            callback(finalFile);
        })
    });
}

function gatherSongList(callback){
    getJSONData(path.normalize("files/songs.json"), function(listJSON){
        callback(listJSON);
    })
}
function createNameAudio(name, callback){
    var file = path.normalize('files/names/' + name + '.wav');
    fs.access(file, fs.F_OK, function(err) {
        if (!err) {
            console.log("Already Cached");
            callback(file);
        } else {
            var params = {
                text: '<prosody rate="25" pitch="130.813Hz">' + name + '</prosody>',
                voice: 'en-US_MichaelVoice', // Optional voice
                accept: 'audio/wav;rate=44100'
            };
            var wstream = fs.createWriteStream(file);
            speech.synthesize(params).pipe(wstream);
            wstream.on('finish', function(){
                callback(file);
            });
            wstream.on('error', function(err){
                console.log(err);
                callback(false);
            });
        }
    });
}

//Using just Sox-Audio
function createFinalSong(nameFile, name, song, callback){

    //Set the directory and name of the final song
    var final = path.normalize('files/final/' + song + '/' + name + '.wav');
    var syllables = syllable(name);
    if (syllables > 3){
        syllables = Math.round(syllables / 2);
    }
    console.log("Syllables: " + syllables);

    //Check that it hasn't already been created
    fs.access(final, fs.F_OK, function(err) {
        //It already exists so return it
        if(!err){
            console.log("Song has been created before");
            callback(final);
            //It hasn't been created yet
        }else{
            console.log("Song is being Created");
            //Set the directories of the song tracks and data
            var songFull = path.normalize('files/tracks/' + song + '/song'  + syllables + '.wav');
            var songFile = path.normalize('files/tracks/' + song + '/data' + syllables + '.json');
            var dir = path.normalize('files/tmp/' + song + "/" + name);
            var nameComplete = path.normalize('files/tmp/' + song + "/" + name + '/Complete.wav');

            //Grab the song's data file and begin
            getJSONData(songFile, function(songData){
                if(!songData){
                    callback(false);
                }else {
                    //Creates an audio track containing just the name
                    generateNameTracks(nameFile, dir, songData, function (nameTracks) {
                        if (!nameTracks) {
                            callback(false);
                        } else {
                            combineNameTracks(nameTracks, nameComplete, function (success) {
                                if (!success) {
                                    callback(false);
                                } else {
                                    if(nameTracks.length == 1){
                                        nameComplete = path.normalize(nameTracks[0]);
                                    }
                                    var finalCommand = soxCommand()
                                        .input(songFull)
                                        .inputSampleRate(22050)
                                        .input(nameComplete)
                                        .inputSampleRate(22050)
                                        .inputChannels(2)
                                        .combine('mix')
                                        .output(final)
                                        .outputBits(16);

                                    finalCommand.run();
                                    finalCommand.on('start', function (commandLine) {
                                        console.log('Spawned sox with command: ' + commandLine);
                                    });

                                    finalCommand.on('progress', function (progress) {
                                        console.log('Processing progress: ', progress);
                                    });
                                    finalCommand.on('end', function () {
                                        fs.remove(dir, function (err) {
                                            if (err) {
                                                console.log("REMOVE DIR ERR: " + err);
                                            } else {
                                                console.log('FINISHED');
                                                callback(final);
                                            }
                                        });
                                    });
                                    finalCommand.on('error', function (err, stdout, stderr) {
                                        console.log('Cannot process audio: ' + err.message);
                                        console.log('Sox Command Stdout: ', stdout);
                                        console.log('Sox Command Stderr: ', stderr);
                                        callback(false);
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}

function combineNameTracks(nameTracks, nameComplete, callback){
    if(nameTracks.length > 1) {
        var command = soxCommand()
            .output(nameComplete)
            .combine('mix')
            .addEffect('gain', '-n');
        for (var i = 0; i < nameTracks.length; i++) {
            console.log("NAME TRACK ADDING: " + nameTracks[i]);
            command.input(nameTracks[i]);
            if (i == nameTracks.length - 1) {
                command.run();
                command.on('start', function (commandLine) {
                    console.log('Spawned sox with command: ' + commandLine);
                });

                command.on('progress', function (progress) {
                    console.log('Processing progress: ', progress);
                });
                command.on('end', function () {
                    console.log('COMBINE FINISHED');
                    callback(true);
                });
                command.on('error', function (err, stdout, stderr) {
                    console.log('COMBINE Cannot process audio: ' + err.message);
                    console.log('COMBINE Sox Command Stdout: ', stdout);
                    console.log('COMBINE Sox Command Stderr: ', stderr);
                    callback(false);
                });
            }
        }
    }else{
        callback(nameTracks[0]);
    }
}

function generateNameTracks (nameFile, dir, songData, callback){

    fs.mkdirs(dir, function(){
        var nameFiles = [];
        for (var i = 0; i < songData.nameCount; i++) {
            var nameLocation = path.normalize(dir + "/" + songData.nameTimes[i] + ".wav");
            nameLocation = nameLocation.replace(':','');

            testGenerateCommand(i, songData, nameFile, nameLocation, function (finalCommand, thisFile) {
                console.log("Running Command");
                finalCommand.run();

                finalCommand.on('prepare', function (args) {
                    console.log('Preparing sox command with args ' + args.join(' '));
                });

                finalCommand.on('start', function (commandLine) {
                    console.log('SOLO Spawned sox with command: ' + commandLine);
                });

                finalCommand.on('progress', function (progress) {
                    console.log('Processing progress: ', progress);
                });
                finalCommand.on('end', function () {
                    console.log('SOLO FINISHED');
                    console.log("LOCATION: " + thisFile);
                    nameFiles[nameFiles.length] = thisFile;
                    if(nameFiles.length == songData.nameCount){
                        callback(nameFiles);
                    }
                });
                finalCommand.on('error', function (err, stdout, stderr) {
                    console.log('SOLO Cannot process audio: ' + err.message);
                    console.log('SOLO Sox Command Stdout: ', stdout);
                    console.log('SOLO Sox Command Stderr: ', stderr);
                    callback(false);
                });
            });
        }
    });



}

function testGenerateCommand(position, songData, nameFile, nameLocation, callback){

    var command = soxCommand()
        .input(nameFile)
        .output(nameLocation)
        .addEffect('pad', songData.nameTimes[position]);
    callback(command, nameLocation);
}

// //Builds the Sox command that will create an audio file which says the given
// //name at specific times to fit the given song (Gained from the songData)
// function generateNameTrackCommand(songData, nameFile, nameLocation, callback){
//     //Initiate the sox command with the first input files
//     var finalCommand= soxCommand("-m " + nameFile );
//     //For the next 2 names
//     for (var i = 1; i < 3; i++) {
//         console.log("Adding a name at: " + songData.nameTimes[i]);
//         //Input a 'hardcoded' sub-command according to SoX Documentation
//         //The sox-audio InputSubcommand function doesn't follow the SoX guidelines
//         finalCommand.input('"|sox ' + nameFile + ' -p pad ' + songData.nameTimes[i] + '"');
//         //If the loop is on the last name
//         if (i == 2) {
//             console.log("Finishing Up");
//             //Insert the output details
//             finalCommand.output(nameLocation)
//                 .outputEncoding('signed')
//                 .outputBits(16)
//                 .outputChannels(2)
//                 .outputFileType('wav');
//             //Return the command to be run
//             callback(finalCommand);
//         }
//     }
// }

function getJSONData(dataFile, callback){
    fs.readFile(dataFile, 'utf8', function(err, data) {
        if(err){
            callback(false);
        } else{
            callback(JSON.parse(data));
        }
    });
}

module.exports = router;