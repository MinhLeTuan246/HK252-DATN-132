function SpecTable({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <p className="tb-section-title">{title}</p>
      <div className="tb-spec-table">
        {rows.map(([k, v]) => (
          <div key={k} className="tb-spec-row">
            <div className="tb-spec-key">{k}</div>
            <div className="tb-spec-val">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommandBlock({ title, commands }: { title: string; commands: string[] }) {
  return (
    <div>
      <p className="tb-section-title">{title}</p>
      <div
        style={{
          backgroundColor: '#060a0e',
          border: '1px solid var(--tb-border)',
          borderRadius: '0.5rem',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {commands.map((cmd) => (
          <code
            key={cmd}
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.7rem',
              color: 'var(--tb-cyan)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
            }}
          >
            {cmd}
          </code>
        ))}
      </div>
    </div>
  );
}

export function SpecTab() {
  return (
    <div
      className="tb-page"
      style={{
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingBottom: '2rem',
      }}
    >
      <div className="tb-page-inner">
        <p className="tb-page-eyebrow">Documentation</p>
        <h1 className="tb-page-title">Technical Specifications</h1>
        <hr className="tb-page-rule" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          <SpecTable
            title="Robot Platform"
            rows={[
              ['Base Robot', 'TurtleBot3 Burger'],
              ['SBC', 'Orange Pi 5 Plus'],
              ['Robot OS', 'Ubuntu 22.04.x'],
              ['ROS Version', 'ROS 2 Humble'],
              ['LiDAR', 'LDLiDAR LD19'],
              ['LiDAR Connection', 'USB-TTL through CP210x / CP2102 adapter'],
              ['LiDAR Topic', '/scan'],
              ['LiDAR Frame', 'base_laser'],
              ['LiDAR Baudrate', '230400'],
            ]}
          />

          <SpecTable
            title="Web Control Stack"
            rows={[
              ['Frontend', 'React + TypeScript'],
              ['ROS Web Bridge', 'rosbridge_server websocket'],
              ['ROS JS Client', 'roslib / roslibjs'],
              ['Default WebSocket', 'ws://172.20.10.2:9090'],
              ['Main Launch File', 'robot_launcher robot_with_bridge.launch.py'],
              ['Main Robot Node', 'robot_launcher.py'],
              ['Map Topic', '/map'],
              ['Pose Topic', '/amcl_pose'],
              ['Velocity Topic', '/cmd_vel'],
              ['Battery Topic', '/battery_state'],
            ]}
          />

          <SpecTable
            title="Main ROS Services"
            rows={[
              ['/start_robot', 'Start TurtleBot3 bringup with LD19 LiDAR'],
              ['/stop_robot', 'Stop robot processes and related modules'],
              ['/start_slam', 'Start Cartographer SLAM'],
              ['/stop_slam', 'Stop Cartographer SLAM'],
              ['/start_navigation', 'Start Nav2 navigation with /home/ubuntu/map.yaml'],
              ['/stop_navigation', 'Stop Nav2 navigation'],
              ['/save_map', 'Save /map to /home/ubuntu/map.yaml and /home/ubuntu/map.pgm'],
              ['/get_module_status', 'Return module status as JSON'],
              ['/start_control', 'Start control.py voice motion control node'],
              ['/stop_control', 'Stop control.py'],
              ['/start_guiding', 'Start guiding.py state-machine node'],
              ['/stop_guiding', 'Stop guiding.py'],
            ]}
          />

          <SpecTable
            title="Map Editor Topics"
            rows={[
              ['/save_location_request', 'Web app sends JSON request to save current pose'],
              ['/save_location_response', 'robot_launcher.py returns save result'],
              ['/location_manage_request', 'Web app sends JSON request to list, rename, or delete saved locations'],
              ['/location_manage_response', 'robot_launcher.py returns saved location list or edit result'],
              ['Saved Location File', '/home/ubuntu/saved_places.yaml'],
              ['Saved Pose Format', 'frame_id, x, y, z, w'],
            ]}
          />

          <SpecTable
            title="Voice Command Interfaces"
            rows={[
              ['Web Voice Input', 'Browser Web Speech API'],
              ['Web Push-to-Talk', 'Voice button or hold V key'],
              ['Robot Voice Input', 'Vosk offline model through USB microphone'],
              ['Robot Voice Node', 'ros2 run robot_launcher voice_command_node'],
              ['/voice_motion_cmd', 'std_msgs/String commands for control.py'],
              ['/voice_guiding_cmd', 'std_msgs/String commands for guiding.py'],
              ['Motion Commands', 'forward, backward, left, right, stop'],
              ['Guiding Commands', 'go to <location>, route <loc1> <loc2>, route --optimize <loc1> <loc2>, pause guiding, return to the dock'],
            ]}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <SpecTable
              title="Navigation Files"
              rows={[
                ['Map YAML', '/home/ubuntu/map.yaml'],
                ['Map Image', '/home/ubuntu/map.pgm'],
                ['Saved Places', '/home/ubuntu/saved_places.yaml'],
                ['Go-To Script', '/home/ubuntu/goto_place.py'],
                ['Save Script', '/home/ubuntu/save_place.py'],
                ['Delete Script', '/home/ubuntu/delete_place.py'],
              ]}
            />

            <SpecTable
              title="Audio"
              rows={[
                ['Microphone', 'USB microphone connected to robot SBC'],
                ['Speaker Output', 'USB audio / ALSA output'],
                ['Playback Command', 'aplay -D plughw:3,0 <file>.wav'],
                ['Module Sounds', 'bringup, cartographer, navigation, control, guiding on/off cues'],
              ]}
            />
          </div>

          <CommandBlock
            title="Common Robot Commands"
            commands={[
              'ros2 launch robot_launcher robot_with_bridge.launch.py',
              'ros2 launch turtlebot3_bringup robot_ld19.launch.py',
              'ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=false rviz:=false',
              'ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=false map:=/home/ubuntu/map.yaml rviz:=false',
              'ros2 run nav2_map_server map_saver_cli -f /home/ubuntu/map',
              'ros2 topic echo /amcl_pose --once',
              'python3 /home/ubuntu/goto_place.py dock',
              'python3 /home/ubuntu/goto_place.py --optimize pos2 pos1',
            ]}
          />

          <SpecTable
            title="Module Panel"
            rows={[
              ['Bringup', 'Enabled / Disabled from /get_module_status'],
              ['Cartographer', 'Enabled / Disabled from /get_module_status'],
              ['Navigation', 'Enabled / Disabled from /get_module_status'],
              ['Control', 'Enabled / Disabled from /get_module_status'],
              ['Guiding', 'Enabled / Disabled from /get_module_status'],
              ['Battery', '0–100%, updated every 3 seconds'],
              ['Linear Velocity', 'cm/s, rounded in UI'],
              ['Angular Velocity', 'cm/s equivalent display from angular.z × 100'],
            ]}
          />
        </div>
      </div>
    </div>
  );
}