var name;

$('#nameEnter').click(function(e){
	e.preventDefault();
	name = document.getElementById('name').value;
	console.log("TO SONG");
    $('#nameContent').fadeOut('medium', function(){
        $('#songContent').fadeIn('medium');
    });
});

$('#backEnter').click(function(e){
	e.preventDefault();
	console.log("TO NAME");
	$('#songContent').fadeOut('medium', function(){
        $('#nameContent').fadeIn('medium');
    });
});

function downloadSong(path){
    console.log("NEW DOWNLOAD: " + path);
    window.location = "?download=" + path;
}

function goHome(){
    window.location = "/";
}


function songSelected(song){
    console.log("Song Selected");
    window.location = "?song=" + song + "&name=" + name;
}