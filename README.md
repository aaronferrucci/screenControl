# screenControl
This project runs on a Kinoma Create or other mobile device. Its purpose
is to implement a count-down timer which controls internet access, and
indirectly screen time. You know, for kids. 

## Components
The system is built from a handful of components. Some components run
on the Kinoma or other mobile device (the "device"). Other components
are implemented externally, in a router, or in another mobile device.

### Front End/UI
The main UI presents itself to the user on the device, via a touchscreen. 
The background color of the screen indicates screen time enabled (green) 
or screen time disabled (red). Tapping the screen toggles between
screen-enabled and screen-disabled states.

The screen is broken up into three areas:

#### Time Left
The time left, in HH:MM_SS format. While screen time is enabled, the time
left decrements by a second each second. When the time left value reaches 0,
screen time is disabled and the time remains at 0. At this point, screen time
remains disabled until Sunday at midnight, when the time is restored
to a default value (14:00:00).

### File System
The time left value is saved in the file system. The value is read from
the file system on app startup, and written back when screen time is 
disabled, and upon app exit.

### Admin Interface
The device implements a simple web server interface for resetting the
time-left value. If the IP address of the device is 192.168.1.69, then
this access sets the time to 12:34:56:

http://192.168.1.59:10001/setTimeLeft?hours=12&minutes=34&seconds=56

Note: the port number is not fixed. A future project will discover the
IP and port of the device dynamically.

###  Back End/Firewall
The device executes http transactions to a cgi script running in a 
router running dd-wrt. Two transactions exist:

#### Enable Access
http://192.168.1.1:8080/network_control.sh?network_mode=1

#### Disable Access
http://192.168.1.1:8080/network_control.sh?network_mode=2

In a future implementation, the back end could be implemented in a less
sketchy system component, for example a raspberry pi acting as a gateway.

## Build/Test Environment
The project was built under Kinoma Studio 1.3.41.3. The device is a Kinoma
Create running Kinoma Software v. 7.0.4, and OS 1.1.

