// Set ikon garis tunggal (konsisten stroke-width 1.75), dipakai di seluruh
// dashboard sebagai pengganti emoji. Setiap entri adalah isi <svg> 24x24.

const ICON_PATHS = {
  droplet: '<path d="M12 2.5c3.5 4 6 7.6 6 10.8a6 6 0 0 1-12 0c0-3.2 2.5-6.8 6-10.8Z"/>',
  flask:
    '<path d="M9 2.5h6M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3"/><path d="M7.5 15h9"/>',
  haze: '<path d="M3 8h13M3 12h18M3 16h13M3 20h18"/>',
  shower: '<path d="M4 14h16M6 14a6 6 0 0 1 12 0"/><path d="M8 18v2M12 18v2.5M16 18v2"/>',
  bucket: '<path d="M4 8h16l-1.6 11.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8L4 8Z"/><path d="M8 8a4 4 0 0 1 8 0"/>',
  thermometer:
    '<path d="M12 14.5V4.5a2 2 0 1 0-4 0v10a4 4 0 1 0 4 0Z"/>',
  wind: '<path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 13h15a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 18h9"/>',
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9.5a1 1 0 0 0 1 1h3.5v-6h3v6H17a1 1 0 0 0 1-1V10"/>',
  activity: '<path d="M3 12h4l2.5 7 4-14L16 12h5"/>',
  database:
    '<path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  bell: '<path d="M6 10a6 6 0 1 1 12 0c0 3.2 1 5 2 6.2H4C5 15 6 13.2 6 10Z"/><path d="M9.5 19a2.5 2.5 0 0 0 5 0"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 8.2a2.7 2.7 0 1 1 1.8 4.9"/><path d="M15.5 14.3c2.3.4 4 2.2 4 4.7"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M4.9 7l1.9 1.1M17.2 16l1.9 1.1M3 12h2.2M18.8 12H21M4.9 17l1.9-1.1M17.2 8l1.9-1.1"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12.5 9.5 17 19 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/>',
  edit: '<path d="M4 20h4L19.5 8.5a2 2 0 0 0-4-4L4 16v4Z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M3 3l18 18"/><path d="M10.6 5.7A10.6 10.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15 15 0 0 1-3 3.6M6.5 7.9A14.9 14.9 0 0 0 2.5 12S6 18.5 12 18.5a9.8 9.8 0 0 0 3.2-.6"/><circle cx="12" cy="12" r="3"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  wifi: '<path d="M4 9a12 12 0 0 1 16 0"/><path d="M7 12.5a8 8 0 0 1 10 0"/><path d="M10 16a4 4 0 0 1 4 0"/><circle cx="12" cy="19.5" r="0.9" fill="currentColor" stroke="none"/>',
  wifiOff:
    '<path d="M3 3l18 18"/><path d="M4 9a12 12 0 0 1 12.7-2.6M20 9a12 12 0 0 0-2-1.6"/><path d="M7 12.5a8 8 0 0 1 6.4-1.7M17 12.5a8.1 8.1 0 0 0-1.3-1"/><path d="M10 16a4 4 0 0 1 2.7-1"/><circle cx="12" cy="19.5" r="0.9" fill="currentColor" stroke="none"/>',
  alert: '<path d="M12 9v4.5"/><circle cx="12" cy="16.5" r="0.4" fill="currentColor" stroke="none"/><path d="M10.9 3.6 2.7 18a1.5 1.5 0 0 0 1.3 2.2h16a1.5 1.5 0 0 0 1.3-2.2L13.1 3.6a1.3 1.3 0 0 0-2.2 0Z"/>',
  waves: '<path d="M2 16c2 0 2.5-2 4.5-2s2.5 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2 2.5-2 2-2"/><path d="M2 11c2 0 2.5-2 4.5-2s2.5 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2 2.5-2 2-2"/>',
};

export function icon(name, { size = 20, className = "" } = {}) {
  const path = ICON_PATHS[name];
  if (!path) return "";
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
