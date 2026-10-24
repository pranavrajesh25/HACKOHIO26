export function RobotArt({ small = false }: { small?: boolean }) {
  return <svg viewBox="0 0 480 270" fill="none" aria-hidden="true" className={small ? "project-art" : "hero-art"}>
    <ellipse cx="275" cy="242" rx="144" ry="17" fill="#DED9EF" />
    <path d="M67 218h59l47-49h98l40-44h112" stroke="#C2B5EA" strokeWidth="3" strokeDasharray="7 7" />
    <path d="m352 217 54-29v-66l-54 30z" fill="#D3CBEC"/><path d="m352 152-47-27 55-29 46 26z" fill="#E7E1F7"/><path d="m352 217-47-28v-64l47 27z" fill="#DDD5F1"/>
    <path d="m113 176 27-15v-39l-27 15z" fill="#D0E9DE"/><path d="m113 137-26-15 27-15 26 15z" fill="#E1F3E9"/><path d="m113 176-26-15v-39l26 15z" fill="#BBDCCB"/>
    <path d="M397 94V64" stroke="#8E7EB7" strokeWidth="3"/><path d="M397 64c34-21 22 26 50 8-31 29-20-19-50-1" fill="#8F7BCD"/>
    <circle cx="178" cy="212" r="17" fill="#353348"/><circle cx="178" cy="212" r="7" fill="#A3A1B4"/><circle cx="292" cy="209" r="17" fill="#353348"/><circle cx="292" cy="209" r="7" fill="#A3A1B4"/>
    <path d="M160 147c0-12 10-22 22-22h99c15 0 25 10 25 23v48c0 11-9 20-20 20H181c-12 0-21-10-21-22z" fill="#FAFAFD" stroke="#C5BEDB" strokeWidth="2"/>
    <path d="M282 126c15 1 24 10 24 23v47c0 11-8 19-20 20v-74z" fill="#E1DAF0"/>
    <rect x="176" y="139" width="101" height="48" rx="17" fill="#373347"/>
    <rect x="192" y="151" width="9" height="15" rx="4.5" fill="#A8E6C6"/><rect x="249" y="151" width="9" height="15" rx="4.5" fill="#A8E6C6"/>
    <path d="M216 167q9 8 18 0" stroke="#A8E6C6" strokeWidth="3" strokeLinecap="round"/>
    <path d="M225 125v-23" stroke="#8E7EB7" strokeWidth="3"/><circle cx="225" cy="98" r="6" fill="#8D73CD"/>
    <rect x="201" y="194" width="47" height="6" rx="3" fill="#D9D3E9"/>
    <path d="m330 87 5-13 5 13 13 5-13 5-5 13-5-13-13-5z" fill="#B9ACDD"/>
    <circle cx="139" cy="74" r="5" fill="#C5BBE1"/><circle cx="369" cy="233" r="4" fill="#B5D8C5"/>
    <path d="m151 63 4-8 4 8 8 4-8 4-4 8-4-8-8-4z" fill="#C9BCED"/>
  </svg>;
}
export function EnergyArt() {
  return <svg viewBox="0 0 480 270" fill="none" aria-hidden="true" className="project-art"><ellipse cx="241" cy="234" rx="134" ry="12" fill="#D5E6DA"/><rect x="129" y="63" width="211" height="157" rx="11" fill="#FAFCF8" stroke="#B6CDBD" strokeWidth="2"/><path d="M154 95h158M154 128h158M154 161h158M154 194h158" stroke="#E2EBE1"/><path d="m157 177 26-21 24 8 24-57 26 31 25-12 30 23" stroke="#5C9474" strokeWidth="4" strokeLinejoin="round"/><circle cx="231" cy="107" r="8" fill="#EBC680" stroke="#FFF8E9" strokeWidth="4"/><rect x="151" y="77" width="51" height="5" rx="2" fill="#C9D9CC"/><rect x="294" y="188" width="69" height="49" rx="8" fill="#E5EEDD" stroke="#B6CDBD"/><path d="m333 197-15 19h11l-3 14 16-20h-11z" fill="#77995C"/><path d="M110 175c-32-29-7-46-7-46 23 8 26 24 7 46" fill="#A4C7A2"/><path d="M109 204v-51" stroke="#6E9D75" strokeWidth="3"/><circle cx="366" cy="77" r="9" fill="#E5DDA9"/></svg>;
}
export function AIArt() {
  return <svg viewBox="0 0 480 270" fill="none" aria-hidden="true" className="project-art"><ellipse cx="246" cy="237" rx="125" ry="11" fill="#E6DDD1"/><rect x="140" y="49" width="177" height="179" rx="10" transform="rotate(-7 140 49)" fill="#EFE6DC" stroke="#D9CBBC" strokeWidth="2"/><rect x="155" y="49" width="177" height="179" rx="10" fill="#FFFCF7" stroke="#D9CBBC" strokeWidth="2"/><rect x="178" y="72" width="68" height="8" rx="4" fill="#D6C6B5"/><path d="M179 104h127M179 120h103M179 153h119M179 169h104M179 200h74" stroke="#DED4C8" strokeWidth="5" strokeLinecap="round"/><rect x="172" y="141" width="139" height="20" rx="4" fill="#F4DEAE" fillOpacity=".7"/><circle cx="320" cy="186" r="37" fill="#E6F0E7" stroke="#8FAE97" strokeWidth="3"/><path d="m305 186 10 10 20-22" stroke="#5F8D6C" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/><path d="m346 213 22 22" stroke="#8FAE97" strokeWidth="10" strokeLinecap="round"/><path d="m111 89 4-10 4 10 10 4-10 4-4 10-4-10-10-4z" fill="#DBC29D"/></svg>;
}
export function RouteMap({ selected = "", onSelect }: { selected?: string; onSelect?: (route: string) => void }) {
  const routes = [{ id: "A", d: "M80 230 L170 230 L245 130 L420 130 L490 90", color: "#A891D4" }, { id: "B", d: "M80 230 L140 320 L370 320 L490 230 L490 90", color: "#64A489" }, { id: "C", d: "M80 230 L170 230 L310 230 L390 195 L490 90", color: "#D2A16E" }];
  return <div className="route-map"><svg viewBox="0 0 580 400" role="img" aria-label={`Fictional campus map. Route A has stairs. Route B uses a garden path of unverified width. Route C is blocked by construction.${selected ? ` Route ${selected} is selected.` : ""}`}>
    <defs><pattern id="mapGrid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#E4E9E2" strokeWidth=".7"/></pattern></defs>
    <rect width="580" height="400" rx="16" fill="#F4F6EE"/><rect width="580" height="400" fill="url(#mapGrid)"/>
    <rect x="195" y="265" width="145" height="93" rx="35" fill="#E0EBD5"/><text x="236" y="302" fill="#8A9E7B" fontSize="11">THE GARDEN</text>
    <rect x="278" y="39" width="112" height="64" rx="7" fill="#E4E1D7"/><text x="297" y="76" fill="#9C988A" fontSize="11">SCIENCE HALL</text>
    <rect x="90" y="68" width="95" height="95" rx="7" fill="#E5E2DA"/><text x="105" y="119" fill="#9C988A" fontSize="11">COURTYARD</text>
    <rect x="404" y="275" width="95" height="58" rx="7" fill="#E5E2DA"/><text x="423" y="307" fill="#9C988A" fontSize="10">ARTS BLOCK</text>
    {[70, 365, 520, 190, 415].map((x, i) => <g key={x}><circle cx={x} cy={[100, 345, 180, 365, 50][i]} r="13" fill="#CDDDBF"/><circle cx={x - 4} cy={[96, 341, 176, 361, 46][i]} r="9" fill="#DCE8D0"/></g>)}
    {routes.map(r => <g key={r.id} onClick={() => onSelect?.(r.id)} style={{ cursor: onSelect ? "pointer" : "default" }}><path d={r.d} stroke="white" strokeWidth="14" strokeLinejoin="round" fill="none"/><path d={r.d} stroke={r.color} strokeWidth={selected === r.id ? 7 : 4} strokeOpacity={!selected || selected === r.id ? 1 : .35} strokeDasharray={selected === r.id ? undefined : "7 6"} strokeLinejoin="round" fill="none"/></g>)}
    <g transform="translate(246 130)"><rect x="-17" y="-14" width="34" height="28" rx="6" fill="#FFF" stroke="#BDA9DC"/><path d="M-10 7h6V2h6v-5h6v-5h5" stroke="#9076B8" fill="none" strokeWidth="3"/></g>
    <g transform="translate(359 212)"><rect x="-18" y="-13" width="36" height="26" rx="5" fill="#FFF6E8" stroke="#D3AA70"/><path d="m-11 7 9-14m-1 14L6-7m-1 14L14-7" stroke="#CE9B5D" strokeWidth="4"/></g>
    <circle cx="80" cy="230" r="12" fill="#6E5B9F" stroke="white" strokeWidth="4"/><text x="36" y="265" fill="#4D455E" fontSize="12" fontWeight="600">Campus Hub</text>
    <circle cx="490" cy="90" r="12" fill="#5C9474" stroke="white" strokeWidth="4"/><text x="466" y="63" fill="#4B6853" fontSize="12" fontWeight="600">Library</text>
    <text x="306" y="117" fill="#9076B8" fontWeight="600" fontSize="13">A · 240 m</text><text x="239" y="345" fill="#5C9474" fontWeight="600" fontSize="13">B · 390 m</text><text x="214" y="216" fill="#B58B59" fontWeight="600" fontSize="13">C · 310 m</text>
  </svg><p>Illustration of your proposal · not proof of real-world safety</p></div>;
}
