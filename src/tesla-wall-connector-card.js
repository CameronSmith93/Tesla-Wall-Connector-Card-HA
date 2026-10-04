/*
 * Tesla Wall Connector card for Home Assistant
 *
 * A front-on Gen 3 Wall Connector whose light bar does what the real one does (top green when
 * idle, blue when talking to a car, streaming green while charging, red blink codes), next to the
 * charger's live figures. Driven by Home Assistant's built-in Tesla Wall Connector integration.
 *
 * Light codes are from Tesla's Wall Connector 3 install manual (APAC), "Wall Connector LEDs".
 */
(() => {   // keep everything out of the page's global scope
  const TWC_CARD_VERSION = '1.1.1';

  // Tesla's faceplates: the standard white glass one and the four colour-matched ones. Each has two
  // photos: handle docked, and handle out (in a car). Every photo is framed the same way.
  const FACEPLATES = {
    white:                    { name: 'White (standard glass)',   light: true,  docked: '__FP_white__',                    in_use: '__FP_white_in_use__' },
    solid_black:              { name: 'Solid Black',              light: false, docked: '__FP_solid_black__',              in_use: '__FP_solid_black_in_use__' },
    midnight_silver_metallic: { name: 'Midnight Silver Metallic', light: false, docked: '__FP_midnight_silver_metallic__', in_use: '__FP_midnight_silver_metallic_in_use__' },
    deep_blue_metallic:       { name: 'Deep Blue Metallic',       light: false, docked: '__FP_deep_blue_metallic__',       in_use: '__FP_deep_blue_metallic_in_use__' },
    red_multi_coat:           { name: 'Red Multi-Coat',           light: false, docked: '__FP_red_multi_coat__',           in_use: '__FP_red_multi_coat_in_use__' },
  };
  const FACEPLATE_ALIASES = { black: 'solid_black', midnight_silver: 'midnight_silver_metallic', deep_blue: 'deep_blue_metallic', red: 'red_multi_coat' };

  // Where things are, as shares of the photo: the light bar; and where the photo sits in the card
  // (left, top, width, in % of the card's width), with the figures to its right.
  const BAR = { x: 26.10, top: 42.05, bottom: 58.72 };
  const UNIT = { left: 3.6, top: 3, width: 34 };
  const INFO_LEFT = 39;
  const LEDS = 7;

  const COLOURS = {
    green: '61, 226, 106',
    blue: '84, 92, 255',
    yellow: '244, 226, 30',
    red: '255, 59, 48',
    white: '255, 255, 255',
  };

  // HA status -> what the light bar shows.
  //   mode: solid | stream | blink2 | all | off;  led: which of the 7 (0 = top)
  const LIGHTS = {
    booting:           { mode: 'all', colour: 'white' },
    not_connected:     { mode: 'solid', led: 0, colour: 'green' },
    connected:         { mode: 'solid', led: 2, colour: 'blue' },
    ready:             { mode: 'solid', led: 2, colour: 'blue' },
    waiting_car:       { mode: 'solid', led: 2, colour: 'blue' },
    charging_finished: { mode: 'solid', led: 2, colour: 'blue' },
    negotiating:       { mode: 'blink2', led: 2, colour: 'blue' },   // two blue blinks: seen on the real charger while it waits on its schedule
    charging:          { mode: 'stream', colour: 'green' },
    // HA's "reduced" is the charger's state 10: charging below three phases at 16 A, which a
    // single-phase charger always is. It isn't overheating, and the real bar just streams green.
    charging_reduced:  { mode: 'stream', colour: 'green' },
    error:             { mode: 'solid', led: 0, colour: 'red' },
  };


  const STATUS_TEXT = {
    booting: 'Starting up',
    not_connected: 'Not plugged in',
    connected: 'Plugged in',
    ready: 'Plugged in · not charging',
    waiting_car: 'Plugged in · not charging',
    charging_finished: 'Charging complete',
    negotiating: 'Waiting to charge',
    charging: 'Charging',
    charging_reduced: 'Charging',
    error: 'Fault',
  };

  const ICONS = {
    car: 'M18.92 2C18.72 1.42 18.16 1 17.5 1H6.5C5.84 1 5.29 1.42 5.08 2L3 8V16C3 16.55 3.45 17 4 17H5C5.55 17 6 16.55 6 16V15H18V16C18 16.55 18.45 17 19 17H20C20.55 17 21 16.55 21 16V8L18.92 2M6.5 12C5.67 12 5 11.33 5 10.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12M17.5 12C16.67 12 16 11.33 16 10.5S16.67 9 17.5 9 19 9.67 19 10.5 18.33 12 17.5 12M5 7L6.5 2.5H17.5L19 7H5M7 20H11V18L17 21H13V23L7 20Z',
    clock: 'M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z',
  };

  const css = `
    :host { display: block; }
    ha-card { overflow: hidden; border-radius: var(--ha-card-border-radius, 12px); background: #0f1012; border: none; }
    .frame { container-type: inline-size; }
    .scene { position: relative; height: 58cqw; overflow: hidden; color: #f2f3f5; user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      background:
        radial-gradient(ellipse 34cqw 46cqw at var(--spot-x, 15cqw) 26cqw, rgba(255,255,255,var(--spot, .075)), rgba(255,255,255,0) 70%),
        linear-gradient(180deg, #202226 0%, #16171a 60%, #111214 100%); }

    /* the charger */
    .unit { position: absolute; container-type: inline-size; cursor: pointer;
      -webkit-tap-highlight-color: transparent; }
    .unit img { position: relative; display: block; width: 100%; height: auto; filter: drop-shadow(0 1.2cqw 1.6cqw rgba(0,0,0,.55)); }
    .unit.offline img { filter: drop-shadow(0 1.2cqw 1.6cqw rgba(0,0,0,.55)) brightness(.82); }
    .tint { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: multiply; opacity: 0;
      -webkit-mask-size: 100% 100%; mask-size: 100% 100%; transition: opacity .6s ease; }
    .led { position: absolute; left: calc(var(--bx) - 1cqw); width: 2cqw; border-radius: 1cqw; background: #fff;
      opacity: 0; --c: 255,255,255;
      box-shadow: 0 0 .5cqw .15cqw rgba(var(--c), .95), 0 0 2cqw .8cqw rgba(var(--c), .55), 0 0 5cqw 2cqw rgba(var(--c), .25); }
    .halo { position: absolute; left: calc(var(--bx) - 9cqw); width: 18cqw; border-radius: 50%; opacity: 0; pointer-events: none;
      filter: blur(2.2cqw); background: rgba(var(--c), .55); }
    /* on the dark faceplate the bar reads as a coloured line, and light adds rather than tints */
    .fp-dark .tint { mix-blend-mode: screen; }
    .fp-dark .led { left: calc(var(--bx) - .6cqw); width: 1.2cqw; border-radius: .6cqw;
      background: rgb(calc(var(--r) * .45 + 140), calc(var(--g) * .45 + 140), calc(var(--b) * .45 + 140));
      box-shadow: 0 0 .4cqw .1cqw rgba(var(--c), 1), 0 0 1.4cqw .4cqw rgba(var(--c), .55), 0 0 3.6cqw 1.2cqw rgba(var(--c), .22); }
    .fp-dark .halo { left: calc(var(--bx) - 5cqw); width: 10cqw; filter: blur(2cqw); background: rgba(var(--c), .35); }

    .led.on { opacity: 1; }
    .led.stream { animation: stream 1.6s linear infinite; }
    @keyframes stream { 0% { opacity: .18; } 18% { opacity: 1; } 45% { opacity: .5; } 100% { opacity: .18; } }
    .led.blink2 { animation: blink2 2.2s steps(1, end) infinite; }
    @keyframes blink2 { 0% { opacity: 1; } 12% { opacity: 0; } 24% { opacity: 1; } 36% { opacity: 0; } 100% { opacity: 0; } }
    .halo.stream { animation: halo 3.2s ease-in-out infinite; }
    @keyframes halo { 0%, 100% { opacity: .45; } 50% { opacity: .75; } }
    @media (prefers-reduced-motion: reduce) { .led.stream, .halo.stream { animation: none; opacity: 1; } }

    /* the figures */
    .info { position: absolute; right: 5cqw; top: 5.4cqw; bottom: 4.6cqw; display: flex; flex-direction: column; }
    .label { font-size: max(10px, 2.3cqw); letter-spacing: .16em; text-transform: uppercase; color: #8d9198; font-weight: 500; }
    .power { margin-top: 1.2cqw; font-size: 10.5cqw; line-height: 1; font-weight: 400; letter-spacing: -.02em; }
    .power small { font-size: .38em; margin-left: .18em; letter-spacing: 0; color: #c7cace; font-weight: 400; }
    .status { margin-top: 1.6cqw; font-size: max(13px, 3.3cqw); color: #d9dbde; display: flex; align-items: center; gap: 1.4cqw; }
    .dot { width: 1.5cqw; height: 1.5cqw; min-width: 6px; min-height: 6px; border-radius: 50%; background: rgb(var(--c)); box-shadow: 0 0 1.2cqw rgba(var(--c), .9); }
    .dot.none { background: #55595f; box-shadow: none; }
    .rows { margin-top: auto; display: flex; flex-direction: column; gap: 1.2cqw; }
    .row { display: flex; align-items: center; gap: 1.6cqw; font-size: max(12px, 2.9cqw); color: #c3c6cb; min-height: 4.4cqw; }
    .row svg { width: max(15px, 3.6cqw); height: max(15px, 3.6cqw); fill: #8d9198; flex: none; }
    .row .grow { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row .aside { color: #8d9198; white-space: nowrap; }
    .muted { color: #6f737a; }
    @container (max-width: 560px) { .pre { display: none; } }
    .stats { margin-top: 2.4cqw; display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid rgba(255,255,255,.09); padding-top: 2.2cqw; }
    .stat { cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .stat + .stat { padding-left: 2.4cqw; border-left: 1px solid rgba(255,255,255,.07); }
    .stat .k { font-size: max(9px, 1.9cqw); letter-spacing: .14em; text-transform: uppercase; color: #7d8188; white-space: nowrap; }
    .stat .v { margin-top: .7cqw; font-size: max(14px, 3.7cqw); color: #eceef0; white-space: nowrap; }
    .stat .v small { font-size: .68em; color: #a3a7ad; margin-left: .15em; }
  `;

  const TIME = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

  // A phase is live when it has voltage. The charger only measures it with its relay closed, so
  // the card works out the phases while charging and remembers them in between.
  const PHASES = ['a', 'b', 'c'];
  const LIVE_V = 100;
  const PHASE_NAME = { 1: '1-phase', 3: '3-phase' };
  // Cars draw a little under what they're offered (30.8 A from a 32 A charger), so anything within
  // this of max_current on every live phase counts as the full rate.
  const FULL_MARGIN_A = 2;

  class TeslaWallConnectorCard extends HTMLElement {
    // A new card picks up the first Wall Connector it finds.
    static getStubConfig(hass) {
      const id = hass && Object.keys(hass.states).find((e) => /^binary_sensor\..+_contactor_closed$/.test(e)
        && hass.states[e.replace(/_contactor_closed$/, '_vehicle_connected')]);
      return { entity_prefix: id ? id.slice('binary_sensor.'.length, -'_contactor_closed'.length) : 'tesla_wall_connector', faceplate: 'white' };
    }

    // The visual editor.
    static getConfigForm() {
      return {
        schema: [
          { name: 'entity_prefix', selector: { text: {} } },
          { name: 'faceplate', selector: { select: { mode: 'dropdown',
            options: Object.entries(FACEPLATES).map(([value, f]) => ({ value, label: f.name })) } } },
          { name: 'name', selector: { text: {} } },
          { name: 'vehicle_name', selector: { text: {} } },
          { name: 'vehicle_battery', selector: { entity: { domain: 'sensor' } } },
          { name: 'max_current', selector: { number: { min: 6, max: 80, step: 1, mode: 'box', unit_of_measurement: 'A' } } },
          { name: 'schedule', type: 'expandable', title: 'Charging schedule', schema: [
            { name: 'start', selector: { time: {} } },
            { name: 'end', selector: { time: {} } },
          ] },
        ],
        computeLabel: (f) => ({
          entity_prefix: 'Entity prefix', faceplate: 'Faceplate', name: 'Title', vehicle_name: 'Vehicle name',
          vehicle_battery: 'Vehicle battery sensor', max_current: 'Maximum current', start: 'Charging allowed from', end: 'Charging allowed until',
        })[f.name],
        computeHelper: (f) => ({
          entity_prefix: 'The part shared by the charger\'s entities, e.g. tesla_wall_connector for sensor.tesla_wall_connector_status. Blank means tesla_wall_connector',
          name: 'Blank means Wall Connector',
          max_current: 'The most the Wall Connector is set to supply on each phase, so the card can tell full-rate charging from reduced',
          schedule: 'The charging times set on the Wall Connector, if any',
        })[f.name],
      };
    }

    setConfig(config) {
      if (!config) throw new Error('Invalid configuration');
      // a field cleared in the editor comes through as '', which means its default too
      this._config = { ...config, faceplate: config.faceplate || 'white',
        entity_prefix: config.entity_prefix || 'tesla_wall_connector', name: config.name || 'Wall Connector' };
      const fp = FACEPLATE_ALIASES[this._config.faceplate] || this._config.faceplate;
      if (!FACEPLATES[fp]) throw new Error(`faceplate must be one of: ${Object.keys(FACEPLATES).join(', ')}`);
      this._faceplate = fp;
      // a schedule only counts once it has both ends (the editor fills it in one field at a time)
      const s = this._config.schedule;
      this._schedule = s && TIME.test(s.start || '') && TIME.test(s.end || '') ? s : null;
      const max = this._config.max_current;
      if (max !== undefined && max !== null && max !== '' && !(Number(max) > 0)) throw new Error('max_current must be a number of amps');
      this._max = Number(max) > 0 ? Number(max) : null;
      try { this._phases = Number(localStorage.getItem(this._phaseKey())) || null; } catch (e) { this._phases = null; }
      this._built = false;
      this._build();
      this._update();
    }

    getCardSize() { return 5; }
    getGridOptions() { return { columns: 12, min_columns: 6, rows: 'auto' }; }

    set hass(hass) { this._hass = hass; this._update(); }

    connectedCallback() { this._timer = setInterval(() => this._update(), 30000); }
    disconnectedCallback() { clearInterval(this._timer); }

    _phaseKey() { return `tesla-wall-connector-card:phases:${this._config.entity_prefix}`; }

    // While charging: how many phases are live, and whether each live one is at max_current.
    _supply(closed) {
      if (!closed) return null;
      const volts = PHASES.map((p) => this._num('sensor', `phase_${p}_voltage`));
      if (volts.some((v) => v === null)) return null;
      const live = PHASES.filter((p, i) => volts[i] > LIVE_V);
      if (!live.length) return null;
      if (live.length !== this._phases) {
        this._phases = live.length;
        try { localStorage.setItem(this._phaseKey(), String(live.length)); } catch (e) { /* not remembered */ }
      }
      const amps = live.map((p) => this._num('sensor', `phase_${p}_current`));
      if (amps.some((a) => a === null)) return { phases: live.length };
      return { phases: live.length, used: amps.filter((a) => a >= 1).length,
               full: this._max ? amps.every((a) => a >= this._max - FULL_MARGIN_A) : null };
    }

    _id(domain, key) { return `${domain}.${this._config.entity_prefix}_${key}`; }
    _st(domain, key) { return this._hass && this._hass.states[this._id(domain, key)]; }
    _num(domain, key) {
      const s = this._st(domain, key);
      if (!s || ['unknown', 'unavailable'].includes(s.state)) return null;
      const v = parseFloat(s.state);
      return Number.isFinite(v) ? v : null;
    }

    _build() {
      if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      const fp = FACEPLATES[this._faceplate];
      this._fp = fp;
      this._src = null;
      const dark = !fp.light;
      const leds = Array.from({ length: LEDS }, (_, i) => {
        const pitch = (BAR.bottom - BAR.top) / LEDS;
        const h = pitch * (dark ? 0.8 : 0.58);
        const top = BAR.top + pitch * i + (pitch - h) / 2;
        return `<div class="led" data-i="${i}" style="top:${top}%;height:${h}%"></div>`;
      }).join('');
      const u = UNIT;
      this.shadowRoot.innerHTML = `
        <style>${css}</style>
        <ha-card>
          <div class="frame"><div class="scene ${dark ? 'fp-dark' : 'fp-light'}"
            style="--spot-x:${u.left + u.width * BAR.x / 100}cqw;--spot:${dark ? .13 : .075}">
            <div class="unit" data-more="sensor:status" role="button" tabindex="0"
              style="left:${u.left}cqw;top:${u.top}cqw;width:${u.width}cqw;--bx:${BAR.x}%">
              <img alt="Wall Connector (${fp.name})">
              <div class="tint"></div>
              <div class="halo" style="top:${BAR.top - 3}%;height:${BAR.bottom - BAR.top + 6}%"></div>
              ${leds}
            </div>
            <div class="info" style="left:${INFO_LEFT}cqw">
              <div class="label"></div>
              <div class="power"></div>
              <div class="status"><span class="dot"></span><span class="stext"></span></div>
              <div class="rows">
                <div class="row vehicle"><svg viewBox="0 0 24 24"><path d="${ICONS.car}"/></svg><span class="grow"></span><span class="aside"></span></div>
                <div class="row sched"><svg viewBox="0 0 24 24"><path d="${ICONS.clock}"/></svg><span class="grow"></span><span class="aside"></span></div>
              </div>
              <div class="stats">
                <div class="stat" data-more="sensor:session_energy" role="button" tabindex="0"><div class="k">Session</div><div class="v s-session"></div></div>
                <div class="stat" data-more="sensor:grid_voltage" role="button" tabindex="0"><div class="k k-grid">Grid</div><div class="v s-grid"></div></div>
                <div class="stat" data-more="sensor:handle_temperature" role="button" tabindex="0"><div class="k">Handle</div><div class="v s-handle"></div></div>
              </div>
            </div>
          </div></div>
        </ha-card>`;
      this.shadowRoot.querySelectorAll('[data-more]').forEach((el) => {
        const open = () => {
          const [d, k] = el.dataset.more.split(':');
          const ev = new Event('hass-more-info', { bubbles: true, composed: true });
          ev.detail = { entityId: this._id(d, k) };
          this.dispatchEvent(ev);
        };
        el.addEventListener('click', open);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
      this._built = true;
    }

    _fmt12(hhmm) {
      let [h, m] = hhmm.split(':').map(Number);
      const ap = h < 12 ? 'AM' : 'PM';
      h = h % 12 || 12;
      return m ? `${h}:${String(m).padStart(2, '0')} ${ap}` : `${h} ${ap}`;
    }

    // minutes until the schedule window opens, or 0 if it is open now
    _untilWindow(now = new Date()) {
      const s = this._schedule;
      if (!s) return null;
      const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const a = toMin(s.start), b = toMin(s.end), n = now.getHours() * 60 + now.getMinutes();
      const inside = a <= b ? n >= a && n < b : n >= a || n < b;
      if (inside) return 0;
      return (a - n + 1440) % 1440;
    }

    _update() {
      if (!this._built || !this._hass) return;
      const r = this.shadowRoot;
      const statusState = this._st('sensor', 'status');
      const status = statusState ? statusState.state : 'unavailable';
      const offline = !statusState || ['unknown', 'unavailable'].includes(status);
      const connected = this._st('binary_sensor', 'vehicle_connected');
      const plugged = connected && connected.state === 'on';
      const contactor = this._st('binary_sensor', 'contactor_closed');
      const closed = contactor && contactor.state === 'on';

      // light bar
      const light = offline ? { mode: 'off' } : (LIGHTS[status] || { mode: 'off' });
      const rgb = COLOURS[light.colour] || COLOURS.white;
      r.querySelector('.scene').style.setProperty('--c', rgb);
      r.querySelector('.unit').classList.toggle('offline', offline);
      // the handle lives in its holster unless a car is plugged in
      const src = plugged ? this._fp.in_use : this._fp.docked;
      if (this._src !== src) {
        this._src = src;
        r.querySelector('.unit img').src = src;
        const t = r.querySelector('.tint');
        t.style.webkitMaskImage = t.style.maskImage = `url(${src})`;
      }
      r.querySelectorAll('.led').forEach((el) => {
        const i = Number(el.dataset.i);
        el.className = 'led';
        el.style.animationDelay = '';
        const setC = (c) => { const [cr, cg, cb] = c.split(',').map(Number); el.style.setProperty('--c', c);
          el.style.setProperty('--r', cr); el.style.setProperty('--g', cg); el.style.setProperty('--b', cb); };
        setC(rgb);
        if (light.mode === 'stream') { el.classList.add('stream'); el.style.animationDelay = `${(i * 0.16).toFixed(2)}s`; }
        else if (light.mode === 'all') el.classList.add('on');
        else if (['solid', 'blink2'].includes(light.mode) && i === light.led) el.classList.add(light.mode === 'solid' ? 'on' : light.mode);
      });
      const halo = r.querySelector('.halo');
      halo.className = 'halo' + (light.mode === 'stream' ? ' stream' : '');
      halo.style.opacity = light.mode === 'stream' ? '' : '0';
      const tint = r.querySelector('.tint');
      const dark = !this._fp.light;
      tint.style.background = `radial-gradient(ellipse ${dark ? '34% 18%' : '60% 26%'} at ${BAR.x}% ${(BAR.top + BAR.bottom) / 2}%, rgba(${rgb}, ${dark ? .3 : .55}), rgba(${rgb}, 0) 70%)`;
      tint.style.opacity = light.mode === 'off' ? '0' : light.mode === 'stream' ? '.9' : '.45';

      // figures
      r.querySelector('.label').textContent = this._config.name;
      let kw = this._num('sensor', 'total_power');
      const pUnit = (this._st('sensor', 'total_power') || { attributes: {} }).attributes.unit_of_measurement;
      if (kw !== null && pUnit === 'W') kw /= 1000;
      if (!closed) kw = 0;                                   // the charger reports ~0.4 A of noise while the relay is open
      r.querySelector('.power').innerHTML = offline ? '–' :
        `${kw >= 10 ? kw.toFixed(0) : kw === 0 ? '0' : kw.toFixed(1)}<small>kW</small>`;

      const amps = this._num('sensor', 'vehicle_current');
      const supply = offline ? null : this._supply(closed);
      let stext = offline ? 'Offline' : (STATUS_TEXT[status] || status);
      const until = this._untilWindow();
      if (!offline && ['charging', 'charging_reduced'].includes(status) && amps !== null) {
        const a = Math.round(amps);
        stext = `Charging · ${a} A`;
        if (supply && supply.full) stext = `Charging · full rate · ${a} A`;
        else if (supply && supply.used < supply.phases) stext = `Charging · reduced · ${supply.used} phase${supply.used === 1 ? '' : 's'}`;
        else if (supply && supply.full === false) stext = `Charging · reduced · ${a} of ${this._max} A`;
      }
      if (!offline && plugged && !closed && until > 0 && !['charging', 'charging_reduced'].includes(status)) stext = 'Waiting for scheduled charging';
      r.querySelector('.stext').textContent = stext;
      r.querySelector('.dot').classList.toggle('none', light.mode === 'off');

      // vehicle row
      const vRow = r.querySelector('.vehicle .grow');
      vRow.textContent = plugged ? (this._config.vehicle_name || 'Vehicle plugged in') : 'No vehicle plugged in';
      vRow.classList.toggle('muted', !plugged);
      const batt = this._config.vehicle_battery && this._hass.states[this._config.vehicle_battery];
      const pct = batt ? parseFloat(batt.state) : NaN;
      r.querySelector('.vehicle .aside').textContent = plugged && Number.isFinite(pct) ? `${Math.round(pct)}%` : '';

      // schedule row
      const sched = r.querySelector('.sched');
      const s = this._schedule;
      sched.style.display = s ? '' : 'none';
      if (s) {
        sched.querySelector('.grow').innerHTML = `<span class="pre">Charging from </span>${this._fmt12(s.start)} to ${this._fmt12(s.end)}`;
        let aside = '';
        if (until > 0) {
          const h = Math.floor(until / 60), m = until % 60;
          aside = h ? `in ${h} h ${m} min` : `in ${m} min`;
        } else if (until === 0) aside = 'Now';
        sched.querySelector('.aside').textContent = aside;
      }

      // stats
      const fmt = (v, d, unit) => (v === null || offline) ? '–' : `${v.toFixed(d)}<small>${unit}</small>`;
      r.querySelector('.s-session').innerHTML = fmt(this._num('sensor', 'session_energy'), 1, 'kWh');
      r.querySelector('.s-grid').innerHTML = fmt(this._num('sensor', 'grid_voltage'), 0, 'V');
      r.querySelector('.k-grid').textContent = PHASE_NAME[this._phases] || 'Grid';
      r.querySelector('.s-handle').innerHTML = fmt(this._num('sensor', 'handle_temperature'), 0, '°C');
    }
  }

  customElements.define('tesla-wall-connector-card', TeslaWallConnectorCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'tesla-wall-connector-card',
    name: 'Tesla Wall Connector',
    description: 'A Gen 3 Wall Connector in your faceplate colour, with a working light bar and its live figures.',
    preview: true,
    documentationURL: 'https://github.com/CameronSmith93/Tesla-Wall-Connector-Card-HA',
  });
  console.info(`%c TESLA-WALL-CONNECTOR-CARD %c ${TWC_CARD_VERSION} `, 'background:#16171a;color:#fff', 'background:#3de26a;color:#000');
})();
