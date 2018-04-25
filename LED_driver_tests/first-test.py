#!/usr/local/bin/python3
import time
import bibliopixel
# causes frame timing information to be output
bibliopixel.log.setLogLevel(bibliopixel.log.DEBUG)

# Load driver for the AllPixel
from bibliopixel.drivers.serial import *
from bibliopixel.drivers.driver_base import *
# set number of pixels & LED type here
length = 90
driver = Serial(num = length, ledtype = LEDTYPE.WS2812B, c_order = ChannelOrder.GRB)

# load the LEDStrip class
from bibliopixel.layout import *
led = Strip(driver)

# load channel test animation
# from bibliopixel.animation import StripChannelTest
# anim = StripChannelTest(led)

from bibliopixel.util import colors
try:
    # run the animation
    # anim.run()
    led.all_off()
    led.update()

    led.set_brightness(32)
    while True:
        for i in range(0,length-1):
            led.set(i, colors.White)
            led.update()
            time.sleep(0.1)
            led.setOff(i)
        for j in range(0,length-1):
            led.set(length-1-j, colors.White)
            led.update()
            time.sleep(0.05)
            led.setOff(length-1-j)

except KeyboardInterrupt:
    # Ctrl+C will exit the animation and turn the LEDs offs
    led.all_off()
    led.update()