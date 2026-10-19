// An illustrated pack for a product without a photo, drawn from its own details:
// the shape follows the dosage form, the colour the category, and the label
// carries the name and strength. Not a real photo of the product.

type Props = { name: string; strength?: string | null; dosageForm?: string | null; category: string; className?: string; bleed?: boolean };

const COLOURS: Record<string, [string, string]> = {
  'Prescription medicines': ['#b45309', '#fef3c7'],
  'Pain & fever': ['#dc2626', '#fee2e2'],
  'Cough, cold & flu': ['#2563eb', '#dbeafe'],
  'Digestive health': ['#7c3aed', '#ede9fe'],
  'Vitamins & supplements': ['#ea7a0c', '#ffedd5'],
  'First aid': ['#be123c', '#ffe4e6'],
  'Skin care': ['#0891b2', '#cffafe'],
  'Mother & baby': ['#db2777', '#fce7f3'],
  'Personal care': ['#0d9488', '#ccfbf1'],
  'Medical devices': ['#475569', '#e2e8f0'],
};

/** A plausible display for the device's screen. */
function reading(name: string) {
  const n = name.toLowerCase();
  if (n.includes('bp') || n.includes('pressure')) return '120/80';
  if (n.includes('oximeter')) return '98%';
  if (n.includes('gluco')) return '5.4';
  if (n.includes('thermo')) return '36.8';
  return '- - -';
}

/** Up to three short lines, so long names stay on the pack. */
function wrap(text: string, width: number) {
  // Break after slashes, and chop any word still too long for the pack.
  const words = text.replace(/\//g, '/ ').split(/\s+/).filter(Boolean)
    .flatMap((w) => w.length <= width ? [w] : w.match(new RegExp(`.{1,${width - 1}}`, 'g'))!.map((part, i, all) => i < all.length - 1 ? part + '-' : part));
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    const joined = last?.endsWith('/') || last?.endsWith('-') ? last + word : last + ' ' + word;
    if (last !== undefined && joined.length <= width) lines[lines.length - 1] = joined;
    else lines.push(word);
  }
  if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].slice(0, width - 1) + '…'; }
  return lines;
}

function Label({ x, y, w, name, strength, colour, width = 13 }: { x: number; y: number; w: number; name: string; strength?: string | null; colour: string; width?: number }) {
  const lines = wrap(name, width);
  const size = lines.some((l) => l.length > width - 2) ? 19 : 22;
  return <g fontFamily="Segoe UI, Arial, sans-serif" textAnchor="middle">
    {lines.map((line, i) => <text key={i} x={x + w / 2} y={y + i * (size + 4)} fontSize={size} fontWeight={700} fill="#1f2b28">{line}</text>)}
    {strength && <text x={x + w / 2} y={y + lines.length * (size + 4) + 6} fontSize={16} fontWeight={600} fill={colour}>{strength}</text>}
  </g>;
}

export default function Packshot({ name, strength, dosageForm, category, className = '', bleed = false }: Props) {
  const [colour, tint] = COLOURS[category] || ['#0e6b5c', '#e6f2ee'];
  const form = dosageForm || 'Other';
  const shadow = <ellipse cx="200" cy="352" rx="120" ry="12" fill="#000" opacity="0.08" />;
  let pack: React.ReactNode;

  if (form === 'Syrup' || form === 'Suspension' || form === 'Drops') {
    // Amber bottle with a white cap.
    pack = <g>
      {shadow}
      <rect x="168" y="40" width="64" height="44" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="160" y="80" width="80" height="22" rx="4" fill="#e2e8f0" />
      <path d="M150 100 h100 q20 0 26 30 l4 30 v175 q0 15 -15 15 h-130 q-15 0 -15 -15 v-175 l4 -30 q6 -30 26 -30z" fill="#92400e" />
      <rect x="132" y="170" width="136" height="140" rx="6" fill="#fff" />
      <rect x="132" y="170" width="136" height="16" rx="6" fill={colour} />
      <Label x={132} y={215} w={136} name={name} strength={strength} colour={colour} width={11} />
    </g>;
  } else if (form === 'Cream' || form === 'Ointment' || form === 'Gel') {
    // Tube lying slightly tilted, cap on the right.
    pack = <g>
      {shadow}
      <g transform="rotate(-8 200 200)">
        <path d="M40 140 h250 l30 20 v80 l-30 20 h-250 z" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="30" y="134" width="22" height="132" rx="3" fill={colour} />
        <rect x="320" y="168" width="44" height="64" rx="6" fill={colour} />
        <rect x="60" y="140" width="230" height="14" fill={colour} opacity="0.85" />
        <Label x={60} y={192} w={230} name={name} strength={strength} colour={colour} width={18} />
      </g>
    </g>;
  } else if (form === 'Inhaler') {
    pack = <g>
      {shadow}
      <rect x="120" y="60" width="110" height="200" rx="26" fill={colour} />
      <rect x="140" y="80" width="70" height="120" rx="10" fill="#fff" opacity="0.9" />
      <path d="M130 250 h140 q25 0 25 25 v40 q0 18 -18 18 h-147 z" fill="#64748b" />
      <rect x="248" y="268" width="60" height="50" rx="10" fill="#475569" />
      <g fontFamily="Segoe UI, Arial, sans-serif" textAnchor="middle" fill="#1f2b28">
        {wrap(name, 8).slice(0, 3).map((l, i) => <text key={i} x="175" y={122 + i * 22} fontSize="17" fontWeight="700">{l}</text>)}
      </g>
    </g>;
  } else if (form === 'Spray') {
    pack = <g>
      {shadow}
      <rect x="180" y="40" width="40" height="60" rx="14" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="160" y="96" width="80" height="34" rx="6" fill="#e2e8f0" />
      <rect x="140" y="128" width="120" height="210" rx="20" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="140" y="160" width="120" height="16" fill={colour} />
      <Label x={140} y={215} w={120} name={name} strength={strength} colour={colour} width={10} />
    </g>;
  } else if (form === 'Sachet') {
    const zig = Array.from({ length: 13 }, (_, i) => `${80 + i * 20},${i % 2 ? 66 : 56}`).join(' ');
    pack = <g>
      {shadow}
      <polygon points={`80,60 ${zig} 320,60 320,330 80,330`} fill={tint} stroke={colour} strokeWidth="3" />
      <rect x="80" y="90" width="240" height="44" fill={colour} />
      <text x="200" y="120" textAnchor="middle" fontFamily="Segoe UI, Arial, sans-serif" fontSize="18" fontWeight="700" fill="#fff">{category.toUpperCase()}</text>
      <Label x={80} y={185} w={240} name={name} strength={strength} colour={colour} width={18} />
    </g>;
  } else if (form === 'Device') {
    pack = <g>
      {shadow}
      <rect x="95" y="50" width="210" height="290" rx="34" fill="#f8fafc" stroke="#94a3b8" strokeWidth="3" />
      <rect x="125" y="85" width="150" height="90" rx="10" fill="#1e293b" />
      <text x="200" y="145" textAnchor="middle" fontFamily="Consolas, monospace" fontSize="38" fontWeight="700" fill="#5eead4">{reading(name)}</text>
      <circle cx="200" cy="300" r="20" fill={colour} />
      <Label x={95} y={212} w={210} name={name} strength={strength} colour={colour} width={15} />
    </g>;
  } else {
    // Carton: tablets, capsules and anything else that comes boxed. Pills along the bottom show the form.
    const pills = form === 'Capsule'
      ? [130, 175, 220, 265].map((x) => <g key={x} transform={`rotate(-30 ${x} 300)`}><rect x={x - 20} y="290" width="40" height="18" rx="9" fill={colour} /><rect x={x} y="290" width="20" height="18" rx="9" fill="#fff" stroke={colour} strokeWidth="2" /></g>)
      : form === 'Tablet'
        ? [135, 180, 225, 270].map((x) => <g key={x}><circle cx={x} cy="300" r="15" fill="#fff" stroke={colour} strokeWidth="3" /><line x1={x - 9} y1="300" x2={x + 9} y2="300" stroke={colour} strokeWidth="2" /></g>)
        : null;
    pack = <g>
      {shadow}
      <path d="M85 70 l30 -25 h200 l-30 25z" fill={colour} opacity="0.7" />
      <path d="M285 70 l30 -25 v270 l-30 25z" fill={colour} opacity="0.85" />
      <rect x="85" y="70" width="200" height="270" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="85" y="70" width="200" height="50" fill={colour} />
      <text x="185" y="102" textAnchor="middle" fontFamily="Segoe UI, Arial, sans-serif" fontSize="15" fontWeight="700" fill="#fff" letterSpacing="1">{(form === 'Other' ? category : form).toUpperCase()}</text>
      <Label x={85} y={160} w={200} name={name} strength={strength} colour={colour} width={14} />
      {pills}
    </g>;
  }

  return (
    <svg viewBox="0 0 400 400" className={className} style={bleed ? { overflow: 'visible' } : undefined} role="img" aria-label={`Illustration of ${name}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`bg-${category.length}-${form.length}`} gradientUnits="userSpaceOnUse" cx="200" cy="160" r="280">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor={tint} />
        </radialGradient>
      </defs>
      {/* With `bleed`, the background extends past the square to fill a wider frame, which must clip it. */}
      <rect x="-400" y="-400" width="1200" height="1200" fill={`url(#bg-${category.length}-${form.length})`} />
      {pack}
    </svg>
  );
}
