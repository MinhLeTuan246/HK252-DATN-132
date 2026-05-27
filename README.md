# HK252-DATN-132

# TurtleBot3 Web Control Application

This project is a web-based control and monitoring application for a TurtleBot3 Burger robot.  
The web app allows the user to control the robot, start robot modules, view the map, manage saved locations, and send voice commands through a browser.

## Main Features

- Start and stop robot modules from the web interface
- Manual robot control using directional buttons or keyboard input
- SLAM map visualization from the `/map` topic
- Navigation mode with initial pose and goal setting
- Saved-location management
  - Save current robot position
  - Show saved locations on the map
  - Rename saved locations
  - Delete saved locations
- Voice command support using the browser Web Speech API
- Robot module status monitoring
- Battery and velocity display
- Console log for system messages

## System Requirements

### Robot Side

- TurtleBot3 Burger
- ROS 2 Humble
- Ubuntu 22.04
- `rosbridge_server`
- Custom `robot_launcher` ROS 2 package
- Navigation2
- Cartographer SLAM
- LD19 LiDAR

### Web Side

- Node.js
- npm
- React
- TypeScript
- ROSLIBJS

## Installation

Install the required npm packages:

```bash
npm install
```

If ROSLIB is not installed yet:

```bash
npm install roslib
npm install --save-dev @types/roslib
```

## Running the Web App

Start the web application:

```bash
npm run dev
```

Then open the displayed local address in the browser, for example:

```text
http://localhost:5173
```

## Running the Robot Side

On the robot, start the ROS bridge and robot launcher:

```bash
ros2 launch robot_launcher robot_with_bridge.launch.py
```

This launch file starts:

- `rosbridge_websocket`
- `robot_launcher.py`

The web app communicates with the robot through rosbridge.

## WebSocket Connection

The web app connects to the robot using a WebSocket address such as:

```text
ws://<robot-ip-address>:9090
```

Example:

```text
ws://172.20.10.2:9090
```

Make sure the robot and the computer running the web app are connected to the same network.

## Main ROS Interfaces

### Services

The web app uses ROS 2 services through rosbridge to control robot modules:

```text
/start_robot
/stop_robot
/start_slam
/stop_slam
/start_navigation
/stop_navigation
/start_control
/stop_control
/start_guiding
/stop_guiding
/save_map
/get_module_status
```

### Topics

The web app uses these ROS 2 topics:

```text
/cmd_vel
/map
/tf
/amcl_pose
/battery_state
/odom
/voice_motion_cmd
/voice_guiding_cmd
/save_location_request
/save_location_response
/location_manage_request
/location_manage_response
```

## Operating Modes

### Manual Driving

In Manual Driving mode, the user can control the robot manually using the directional pad or keyboard.

If SLAM is disabled, only the Bringup module is started.

If SLAM is enabled, Bringup and Cartographer are started so the robot can create a map while moving.

### Navigation

In Navigation mode, the robot uses a saved map and Navigation2.

The user can:

- Set the initial pose
- Send a navigation goal
- View the robot position on the map
- Use saved-location guiding

## Saved Locations

Saved locations are stored on the robot in:

```text
/home/ubuntu/saved_places.yaml
```

Each saved location contains:

- Position `x`
- Position `y`
- Position `z`
- Orientation `x`
- Orientation `y`
- Orientation `z`
- Orientation `w`

These saved positions can be used later for automatic guiding.

## Voice Control

The web app supports voice commands using the browser Web Speech API.

Example commands:

```text
turn on bring up
turn off bring up
turn on navigation
turn off navigation
turn on guiding
go to the dock
go to the table
pause guiding
return to the dock
```

Voice commands are translated into ROS service calls or published to ROS topics.

## Notes

- The robot must be connected to the same network as the web app.
- The ROS bridge must be running before the web app can communicate with the robot.
- Navigation requires a valid map and an initial pose.
- Saved-location guiding requires the Guiding module to be enabled.
- If the web app loses connection, the robot-side ROS system can still continue running locally.

## Project Structure

```text
src/
├── MainTab.tsx
├── ControlPanel.tsx
├── DirectionalPad.tsx
├── Module.tsx
├── SlamMap.tsx
├── MapEditorPanel.tsx
├── VoiceCommand.tsx
├── InstructionTab.tsx
├── SpecTab.tsx
└── Header.tsx
```

## Build

To build the web app:

```bash
npm run build
```

## Author

Graduation thesis project using TurtleBot3 Burger, ROS 2 Humble, Navigation2, Cartographer, rosbridge, and React.

