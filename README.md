# Metra LED-Map
The code in this project is used to drive a set of programmable LED strips that will indicate the relative positions of trains on Chicago's Metra Lines. The

## Spreadsheet of Raw Data
The `LineData` directory contains a spreadsheet in Open Document (ODS) format. I used this spreadsheet to calculate the values that I then output to the `RouteFiles/LineData-<line_name).csv` files that are read by the main Javascript code that drives the LEDs.

## Route Files
The `RouteFiles` directory contains the CSV output from the spreadsheet in the `RawData` directory for the routes that are being displayed on the LED strip.


