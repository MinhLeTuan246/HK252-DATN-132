export function InstructionTab() {
  const Step = ({ n, text }: { n: string; text: string }) => (
    <div className="tb-instruction-step">
      <span className="tb-step-num">{n}</span>
      <span className="tb-step-text">{text}</span>
    </div>
  );

  const Card = ({ title, desc }: { title: string; desc: React.ReactNode }) => (
    <div
      style={{
        padding: '1rem',
        backgroundColor: 'var(--tb-surface)',
        border: '1px solid var(--tb-border)',
        borderRadius: '0.5rem',
      }}
    >
      <p
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.65rem',
          fontWeight: 700,
          color: 'var(--tb-cyan)',
          marginBottom: '0.5rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.75rem',
          color: 'var(--tb-muted)',
          lineHeight: 1.6,
        }}
      >
        {desc}
      </p>
    </div>
  );

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
        <h1 className="tb-page-title">User Instructions</h1>
        <hr className="tb-page-rule" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          <section>
            <p className="tb-section-title">System Startup</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Step n="01" text="Power on the TurtleBot3 Burger and make sure the SBC is connected to the same network as the web client." />
              <Step n="02" text="On the robot, launch the web bridge with: ros2 launch robot_launcher robot_with_bridge.launch.py" />
              <Step n="03" text="Open the React web dashboard. The status should become Active when rosbridge is reachable." />
              <Step n="04" text="Use the Set button or voice commands to launch Bringup, Cartographer, Navigation, Control, and Guiding modules." />
            </div>
          </section>

          <section>
            <p className="tb-section-title">Operating Modes</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Card
                title="Manual Driving"
                desc="Use this mode for direct teleoperation. If SLAM is set to No, Set starts only Bringup. If SLAM is set to Yes, Set starts Bringup and Cartographer so the robot can map while being driven."
              />
              <Card
                title="Navigation"
                desc="Use this mode for autonomous movement on a saved map. Set starts Bringup and Nav2 Navigation. After setting the initial pose, the map panel can be used to set pose or send a goal by clicking on the map."
              />
            </div>
          </section>

          <section>
            <p className="tb-section-title">Manual Control</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Step n="01" text="Start Bringup first. The directional pad is disabled until Bringup is enabled." />
              <Step n="02" text="Use the D-pad buttons for forward, backward, left, right, and stop." />
              <Step n="03" text="Keyboard control is also supported: W / Arrow Up, S / Arrow Down, A / Arrow Left, D / Arrow Right, and Space for stop." />
              <Step n="04" text="The module panel shows current linear and angular velocity in cm/s." />
            </div>
          </section>

          <section>
            <p className="tb-section-title">SLAM Mapping</p>
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--tb-surface)',
                border: '1px solid var(--tb-border)',
                borderRadius: '0.5rem',
              }}
            >
              <p
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.75rem',
                  color: 'var(--tb-muted)',
                  lineHeight: 1.7,
                }}
              >
                To build a map, choose <span style={{ color: 'var(--tb-cyan)' }}>Manual Driving</span>, set SLAM to{' '}
                <span style={{ color: 'var(--tb-cyan)' }}>Yes</span>, then press Set. The web map subscribes to{' '}
                <span style={{ color: 'var(--tb-cyan)' }}>/map</span> and displays the robot pose. Use Export Map to save the map as{' '}
                <span style={{ color: 'var(--tb-cyan)' }}>/home/ubuntu/map.yaml</span> and{' '}
                <span style={{ color: 'var(--tb-cyan)' }}>/home/ubuntu/map.pgm</span>.
              </p>
            </div>
          </section>

          <section>
            <p className="tb-section-title">Navigation Workflow</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Step n="01" text="Choose Navigation mode and press Set. This starts Bringup and Nav2 Navigation using /home/ubuntu/map.yaml." />
              <Step n="02" text="Use Set Pose on the map to initialize the robot pose, similar to RViz 2D Pose Estimate." />
              <Step n="03" text="Use Set Goal on the map to send a Nav2 goal by clicking a coordinate on the map." />
              <Step n="04" text="The selected Set Pose / Set Goal button is shown with forced black background and white text." />
            </div>
          </section>

          <section>
            <p className="tb-section-title">Saved Locations</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Card
                title="Save Location"
                desc="The Map Editor can read the current /amcl_pose and save it to /home/ubuntu/saved_places.yaml. If the name already exists, the app asks whether to overwrite it."
              />
              <Card
                title="Show Locations"
                desc="The Map Editor can list locations from saved_places.yaml, show their x, y, z, w pose parameters, and allow renaming or deleting entries."
              />
            </div>
          </section>

          <section>
            <p className="tb-section-title">Voice Command</p>
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--tb-surface)',
                border: '1px solid var(--tb-border)',
                borderRadius: '0.5rem',
              }}
            >
              <p
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.75rem',
                  color: 'var(--tb-muted)',
                  lineHeight: 1.7,
                }}
              >
                The web app uses the browser microphone and Web Speech API. Hold the voice button or hold the V key to talk.
                Recognized text is interpreted with keyword and route matching, then converted into ROS service calls or topic messages.
                Supported examples include starting modules, stopping modules, moving forward/backward/left/right, pausing guiding,
                returning to dock, moving to a saved location, and multi-location guiding routes.
              </p>
            </div>
          </section>

          <section>
            <p className="tb-section-title">Control and Guiding</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Card
                title="Control Node"
                desc="Start Control to enable movement commands through /voice_motion_cmd. The robot-side control.py still handles obstacle safety, such as stopping when an obstacle is detected ahead."
              />
              <Card
                title="Guiding Node"
                desc="Start Guiding after Navigation is running. Guiding listens to /voice_guiding_cmd and uses goto_place.py with saved_places.yaml to move to named locations, route through multiple places, pause, resume, and return to dock."
              />
            </div>
          </section>

          <section>
            <p className="tb-section-title">Safety</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                'Always monitor the robot while it is moving.',
                'Use the D-pad center stop or Space key to stop manual motion.',
                'Use Kill Process to stop Bringup, Cartographer, Navigation, Control, and Guiding processes.',
                'Set the initial pose carefully before using Navigation or saving named locations.',
                'Do not run autonomous navigation in a crowded or unstable environment.',
              ].map((t) => (
                <div
                  key={t}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--tb-surface)',
                    border: '1px solid var(--tb-border)',
                    borderRadius: '0.5rem',
                  }}
                >
                  <span style={{ color: 'var(--tb-yellow)', flexShrink: 0, marginTop: '1px' }}>!</span>
                  <span
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.75rem',
                      color: 'var(--tb-text)',
                    }}
                  >
                    {t}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}