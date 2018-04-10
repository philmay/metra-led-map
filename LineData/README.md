# Line Data
This directory contains the raw data for the geography of the Metra lines (KML files) and a spreadsheet that converts the raw KML line segment endpoint latitudes and longitudes into information that the LED-Map Javascript code needs to calculate train positions and light LEDs.

## KML
The KML files in this directory are simplifications of the KML files that can be found on the Wikipedia page for each line. To create these simplified files, I opened the Wikipedia KML files in Google Maps and drew another set of simpler line segments over the top. I saved this simpler set of line segments as the KML in this directory.

## Spreadsheet
The spreadsheet in this directory (in ODS format) contains a tab for each line that is being modeled by the Metra LED-Map software. Basically, using the KML lat-lon data as a starting point (columns B and C) to calculate lat and lon values for each LED, number of LEDs needed per segment, etc. A line is present for each segment endpoint in the KML file.

Column A is a convenience to make parsing the file in Javascript easier. Only lines in the CSV file that have an entry in the first column are important, and the value in the first column is the index for that segment endpoint. The actual segment indexes (one fewer that the number of endpoints) appear in column S.
