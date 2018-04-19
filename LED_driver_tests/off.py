#!/usr/local/bin/python3

import bibliopixel
# causes frame timing information to be output
bibliopixel.log.setLogLevel(bibliopixel.log.DEBUG)

# Load driver for the AllPixel
from bibliopixel.drivers.serial import *
from bibliopixel.drivers.driver_base import *
# set number of pixels & LED type here
driver = Serial(num = 50, ledtype = LEDTYPE.WS2812B, c_order = ChannelOrder.GRB)

# load the LEDStrip class
from bibliopixel.layout import *
led = Strip(driver)

# load channel test animation
# from bibliopixel.animation import StripChannelTest
# anim = StripChannelTest(led)

from bibliopixel.util import colors
led.all_off()
led.update()

