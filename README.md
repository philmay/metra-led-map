# Metra LED-Map
The code in this project is used to drive a set of programmable LED strips that will indicate the relative positions of trains on Chicago's Metra Lines.

## bibliopixel
The bibliopixel library is required to drive the LED strips. That can be installed via
```
$ pip3 install bibliopixel
```
## Start App

### LED Interface
In a window, start the LED interface HTTP server - `python3 http-led-server.py`

### Metra Location Fetch
In another window, start the app that fetches train locations, calculates the LEDs to light, and sends the LED positions to the LED interface HTTP server started above - `node index.js`

## Spreadsheet of Raw Data
The `LineData` directory contains a spreadsheet in Open Document (ODS) format. I used this spreadsheet to calculate the values that I then output to the `RouteFiles/LineData-<line_name).csv` files that are read by the main Javascript code that drives the LEDs.

## Route Files
The `RouteFiles` directory contains the CSV output from the spreadsheet in the `RawData` directory for the routes that are being displayed on the LED strip.


