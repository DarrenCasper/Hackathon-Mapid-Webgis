
export function Header() {
  return (
    <header className="app-header">
      <a href="#explore" className="brand" aria-label="TransitFit AI — jelajahi sekitar stasiun">
        <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
          <defs><linearGradient id="brand-gradient" x2="1" y2="1"><stop stopColor="#a78bfa"/><stop offset="1" stopColor="#4f46e5"/></linearGradient></defs>
          <path d="M24 2 44 13v22L24 46 4 35V13Z" fill="url(#brand-gradient)"/>
          <path d="m24 2 20 11-20 12L4 13Z" fill="#c4b5fd"/>
          <path d="m24 25 20-12v22L24 46Z" fill="#6551dc"/>
          <path d="m24 12 11 6v12l-11 6-11-6V18Z" fill="#f4f0ff"/>
          <path d="m24 12 11 6-11 6-11-6Z" fill="#ddd6fe"/>
          <path d="M24 24v12l11-6V18Z" fill="#a5b4fc"/>
        </svg>
        <span>TransitFit <em>AI</em><small>LANGKAH KECIL. TEMUAN BARU.</small></span>
      </a>
      <nav className="page-nav" aria-label="Navigasi utama">
        {[["beranda","Beranda"],["map","Map"],["tempat","Tempat"],["insight","Insight"]].map(([id,label]) => <a key={id} href={`#/${id}`} aria-current={(window.location.hash.startsWith(`#/${id}`) || (id === "map" && !window.location.hash.startsWith("#/"))) ? "page" : undefined}>{label}</a>)}
      </nav>
      <a className="header-link" href="#/lapor">Laporkan jalur ↗</a>
    </header>
  );
}
