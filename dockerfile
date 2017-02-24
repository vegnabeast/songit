############################################################
# Dockerfile to build SONG IT || The new era in music
############################################################

# Set the base image to node's Argon
FROM node:6.9.5

#File Author / Maintainer
MAINTAINER Thomas Rowe

# Create app directory
RUN mkdir -p /app
WORKDIR /app

# Install app dependencies
COPY package.json /app/
RUN npm install


# Bundle app source
COPY . /app

# Expose ports
EXPOSE 3000

# NOTE: This should be "CMD [ "npm", "start" ]" But for reasons unknown that wouldn't work
CMD [ "npm", "start" ]
