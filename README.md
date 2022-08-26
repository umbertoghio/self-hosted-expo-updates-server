<h2 align="center">Self Hosted Expo Updates Server</h2>

# Intro
Self Hosted Expo Update Server is ... a ready to use, battery included, Expo-compatible server to manage updates that you can host yourself in the cloud and have full control and visibility on the update cycle, including rollbacks!

I love the ability to push over-the-air updates with expo, it is a fantastic feature, but with great power comes great responsibility.
The console-only interface can be tricky, the risk of making mistakes is high (especially on ejected app with incompatible binaries), if you want to roll back you really need to know what you are doing. And a single mistake can have potentially devastating impact.

I have already made a simple helper library that I use in my expo projects to simplify the update setup on the mobile side, check out [expo-custom-updater](https://github.com/umbertoghio/expo-custom-updater)

This is my attempt to simplify my own life when dealing with updates on the server side, and hopefully it can be useful to you too!

Features:
* Manage multiple Expo Apps
* Manage multiple Versions and Release Channels
* Send expo updates securely to the server and decide later when / how to release to users
* Roll back to a previous update
* Get insight on how many client app downloaded the update, see your changes being released in real time
* Get a ton of info on the update, including git branch, commit, package.json and app.json information
* Assisted app configuration with self-signed certificate generator.
* All from a simple Web interface

![image](https://user-images.githubusercontent.com/25666241/187002130-bd4fcf5e-20ab-4dcf-944c-127dd535df68.png)

![image](https://user-images.githubusercontent.com/25666241/187002164-56841c80-27f1-4055-9fa2-f1efd6fe3cf7.png)

![image](https://user-images.githubusercontent.com/25666241/187002193-ee179043-545e-4c71-ba3d-762447688c27.png)

![image](https://user-images.githubusercontent.com/25666241/187002214-eaaf68bf-9d17-44b8-afc9-dd27a0f861e0.png)

# Install / Setup

## Play around in Dev
If you have Docker installed you clone this project you and play around by running `yarn` in the root folder and then running `yarn dev:run` to start the Docker/development docker compose. Web credentials are admin/devserver (admin password is set in the docker-compose file). 

## Deploy on your server
If you use Docker you can find a production-ready docker-compose files under the Docker folder, just copy Docker/production on your server, set your secrets / credentials and you are ready to go. The two docker images are public and ready to go.

Otherwise you can build from code, there's a NodeJS API server under the API folder and a React / Vite web project under the Web foder.

## Add your app
Use the web interface to add your application, just enter the expo slug name
![image](https://user-images.githubusercontent.com/25666241/187002757-b6cba5f6-7102-4523-bfac-05ace89b88d5.png)


## Setup a script to publish updates
You can download the ready to use publish script or create your own, the script logic is simple: 
- use `expo publis --experimental-bundle` to generate an update
- Add app.json and package.json to the build folder
- Zip the build folder
- use curl to push the zip file to the server

![image](https://user-images.githubusercontent.com/25666241/187003060-038ad075-4ff5-4a28-90e2-f9f7a4577176.png)


## Generate Self Signed certificate and private key
In order to validate the update expo needs a certificate.pem inside your app and a private key on the update server.
Use the SERVER CONFIGURATION section to generate a new self-signed key, make sure to SAVE, then downlaod both key and back them up!
![image](https://user-images.githubusercontent.com/25666241/187003070-c348189d-b159-4cfd-9f03-3801ea7e9b40.png)

## Configure your app
It is necessary to configure your app.json, android-manifest.xml and Expo.plist properly in order to have this update server working correctly.
Use the APP CONFIGURATION section to have the relevant configuration auto-generated for your project.
Particularly important is the url, expo-channel-name and expo-project values in each of the configuration file.
Make sure to have a runtime version specified too in app.json!

## Build a new app
Updates don't work in dev, you need to build a new app to test the system. You can use the dummy app under the Mobile folder to do your experiments.

## Publish and release an update
This part should be the simplest: call the provided script with appropiate parameters and see your update pop in the web UI.
Release, rollback or delete the updates and see the clients updating in the homepage.

# Contribute
Feel free to clone, costomize and send back PR!

Have fun!
