
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

import bibliopixel
bibliopixel.log.setLogLevel(bibliopixel.log.DEBUG)

from bibliopixel.drivers.serial import *
from bibliopixel.drivers.driver_base import *
driver = Serial(num = 180, ledtype = LEDTYPE.WS2812B, c_order = ChannelOrder.GRB)

from bibliopixel.layout import *
led = Strip(driver)

from bibliopixel.util import colors

# LED Object for GET
leds_state = []

class MyHandler(BaseHTTPRequestHandler):

    def _set_response(self, code):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()

    def do_GET(self):
        global leds_state
        self._set_response(200)
        self.wfile.write(bytearray(str(leds_state), 'utf-8'))

    def do_POST(self):
        print("Received POST request.")
        global leds_state
        content_length = int(self.headers['Content-Length']) # <--- Gets the size of data
        post_data = self.rfile.read(content_length) # <--- Gets the data itself

        if self.headers['Content-Type'] == 'application/json':
            code = 201
            statusMessage = '{"status":"ok"}'
            body_array = json.loads(post_data.decode('utf-8'))
            # print("Parsed JSON -> python object:", str(body_array), "\n")
            led.all_off()
            # led.update()
            led.push_to_driver()
            leds_state = []

            led.set_brightness(64)
            for led_object in body_array:
                if 'position' in led_object.keys():
                    if 'color' in led_object.keys():
                        led_color = colors.names.name_to_color(led_object['color'])
                    else:
                        print("\tWARNING: LED 'color' attribute missing = white")
                        led_color = colors.names.name_to_color('White')
                        led_object['color'] = 'White'

                    leds_state.append(led_object)
                    # print("    lighting " + str(led_object['position']) + " " + led_object['color'])
                    led.set(led_object['position'], led_color)

                else:
                    print("\tERROR: No 'position' attribute in object")
            print("    updating led module")
            # led.update()
            led.push_to_driver()

        else:
            print("\tERROR: Content-Type not application/json - ", self.headers['Content-Type'])
            code = 400
            statusMessage = '{"status":"Content-Type must be application/json"}'

        self._set_response(code)
        self.wfile.write(bytearray(statusMessage, 'utf-8'))

    def do_DELETE(self):
        global leds_state
        led.all_off()
        # led.update()
        led.push_to_driver()
        leds_state = []
        self._set_response(204)
        self.wfile.write(bytearray('{"status":"cleared"}', 'utf-8'))


def run(server_class=HTTPServer, handler_class=MyHandler, port=8675):
    server_address = ('localhost', port)
    httpd = server_class(server_address, handler_class)
    print('Starting httpd on port 8675...\n')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print('Stopping httpd...\n')
    print('Clearing LEDs...\n')
    led.all_off()
    # led.update()
    led.push_to_driver()

if __name__ == '__main__':
    from sys import argv

    if len(argv) == 2:
        run(port=int(argv[1]))
    else:
        run()
