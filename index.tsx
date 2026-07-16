import { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DATEN (Stand 1. April 2026 · Verlautbarung Statistik Austria)
// ─────────────────────────────────────────────────────────────────────────────
const RICHTWERTE = {
  Burgenland: 6.15, "Kärnten": 7.89, "Niederösterreich": 6.92,
  "Oberösterreich": 7.3, Salzburg: 9.31, Steiermark: 9.3,
  Tirol: 8.22, Vorarlberg: 10.35, Wien: 6.74,
};
const GKA = { // Grundkostenanteile €/m² (Basis für den Lagezuschlag)
  Burgenland: 58.86, "Kärnten": 143.44, "Niederösterreich": 166.91,
  "Oberösterreich": 164.25, Salzburg: 320.64, Steiermark: 222.92,
  Tirol: 223.91, Vorarlberg: 352.42, Wien: 347.99,
};
const KATBETRAG = { A: 4.51, B: 3.38, C: 2.25, Dbrauchbar: 2.25, Dunbrauchbar: 1.13 };

// ─────────────────────────────────────────────────────────────────────────────
// FUSSNOTEN – werden am Seitenende gesammelt ausgegeben
// ─────────────────────────────────────────────────────────────────────────────
const FOOTNOTES = [
  ["Mietrechtsgesetz (MRG) im RIS – §§ 1, 15a, 16, 18, 45", "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10002531"],
  ["Statistik Austria – Richtwerte und Kategoriebeträge (Verlautbarung ab 1.4.2026)", "https://www.statistik.at/statistiken/bevoelkerung-und-soziales/wohnen/richtwerte-und-kategoriebetraege"],
  ["Immo-Pauker – Neue Richtwerte, Kategoriebeträge, Grundkostenanteile und § 45-Beträge ab April 2026", "https://immo-pauker.at/mietrecht-neue-richtwerte-und-kategoriebetraege-ab-april-2026/"],
  ["HSP Rechtsanwälte – Mietrecht-Update: Valorisierung ab April 2026 (Mietpreisbremse 1 %/2 %/3 %-Regel)", "https://hsp.law/aktuelles/mietrecht-update-valorisierung-ab-april-2026"],
  ["Mietervereinigung Österreichs – Richtwert und Richtwertmiete", "https://www.mietervereinigung.at/news/richtwert-und-richtwertmiete"],
  ["Arbeiterkammer – Richtwertmiete: Normwohnung, Zu- und Abschläge, Befristungsabschlag", "https://vbg.arbeiterkammer.at/akblog/konsum/richtwertmiete-erdachte-wohnung-wird-norm.html"],
  ["kurzzeitmiete.at – Richtwertmietzins: Anwendungsbereich, Zu-/Abschläge, Rückforderung", "https://www.kurzzeitmiete.at/de/Vermieter/Richtwertmietzins"],
];
const Fn = ({ n }) => (
  <a href={"#fn-" + n} style={{ color: "#8E8E93", textDecoration: "none", fontSize: "0.72em", verticalAlign: "super", fontWeight: 600, marginLeft: 1 }}>[{n}]</a>
);

// ─────────────────────────────────────────────────────────────────────────────
// KATEGORIE gem. §15a Abs 1 MRG
// ─────────────────────────────────────────────────────────────────────────────
const CRITERIA = [
  { id: "brauchbar", label: "Brauchbarer Zustand", hint: "Zum sofortigen Bewohnen geeignet, keine gravierenden Mängel" },
  { id: "flaeche30", label: "Nutzfläche mind. 30 m²", hint: "Nur Voraussetzung für Kategorie A" },
  { id: "zimmer", label: "Zimmer", hint: "Mindestens ein Wohnraum" },
  { id: "kueche", label: "Küche oder Kochnische", hint: "" },
  { id: "vorraum", label: "Vorraum", hint: "" },
  { id: "wc", label: "Klosett (WC) im Inneren", hint: "Voraussetzung für Kat. A, B und C" },
  { id: "bad", label: "Zeitgemäße Badegelegenheit", hint: "Baderaum oder Badenische – Voraussetzung für Kat. A und B" },
  { id: "wasser", label: "Wasserentnahmestelle im Inneren", hint: "Mindeststandard für Kategorie C" },
  { id: "heizung", label: "Zentral-/Etagenheizung o. gleichwertig", hint: "Auch gemeinsame Wärmeversorgungsanlage – nur Kat. A" },
  { id: "warmwasser", label: "Warmwasseraufbereitung", hint: "Nur Voraussetzung für Kategorie A" },
];
function computeCategory(s) {
  if (s.brauchbar && s.flaeche30 && s.zimmer && s.kueche && s.vorraum && s.wc && s.bad && s.heizung && s.warmwasser) return "A";
  if (s.brauchbar && s.zimmer && s.kueche && s.vorraum && s.wc && s.bad) return "B";
  if (s.brauchbar && s.wc && s.wasser) return "C";
  return "D";
}
const CAT_META = {
  A: { color: "#00C48C", desc: "Alle Merkmale der Normwohnung erfüllt: brauchbar, ≥ 30 m², Zimmer, Küche/Kochnische, Vorraum, WC, zeitgemäßes Bad, Heizung, Warmwasser (§15a Abs 1 Z 1 MRG)." },
  B: { color: "#4D7CFE", desc: "Brauchbar mit Zimmer, Küche/Kochnische, Vorraum, WC und zeitgemäßem Bad – aber ohne Heizung/Warmwasser oder unter 30 m² (§15a Abs 1 Z 2 MRG)." },
  C: { color: "#F5A623", desc: "Brauchbar, WC und Wasserentnahmestelle im Inneren vorhanden (§15a Abs 1 Z 3 MRG)." },
  D: { color: "#FF5C5C", desc: "Kein WC oder keine Wasserentnahmestelle im Inneren – oder eine der Anlagen bzw. die Wohnung unbrauchbar (§15a Abs 1 Z 4 MRG)." },
};

// ─────────────────────────────────────────────────────────────────────────────
// UI-Bausteine
// ─────────────────────────────────────────────────────────────────────────────
const card = { background: "#fff", borderRadius: 20, border: "1px solid #ECECEE", padding: 20, marginBottom: 14 };
const label13 = { fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 };
const numInput = {
  width: "100%", fontSize: 16, fontWeight: 600, padding: "11px 14px", borderRadius: 12,
  border: "1px solid #E3E3E6", background: "#FAFAFA", outline: "none", fontFamily: "inherit",
};
function Switch({ on }) {
  return (
    <span aria-hidden style={{ flexShrink: 0, width: 46, height: 28, borderRadius: 999, padding: 3, background: on ? "#0E0E10" : "#E3E3E6", transition: "background .2s", display: "block" }}>
      <span style={{ display: "block", width: 22, height: 22, borderRadius: "50%", background: "#fff", transform: on ? "translateX(18px)" : "none", transition: "transform .2s", boxShadow: "0 1px 3px rgba(0,0,0,.15)" }} />
    </span>
  );
}
function ToggleRow({ label, hint, on, onClick, border }) {
  return (
    <button className="row" onClick={onClick} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
      padding: "15px 18px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left",
      borderTop: border ? "1px solid #F2F2F4" : "none", transition: "background .15s",
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 12.5, color: "#8E8E93", marginTop: 2 }}>{hint}</div>}
      </div>
      <span style={{ marginLeft: 16 }}><Switch on={on} /></span>
    </button>
  );
}
function Pills({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)} style={{
          border: "1px solid " + (value === o ? "#0E0E10" : "#E3E3E6"), background: value === o ? "#0E0E10" : "#fff",
          color: value === o ? "#fff" : "#48484A", borderRadius: 999, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .15s",
        }}>{o}</button>
      ))}
    </div>
  );
}
// Schritt-Karte mit Paragraphen-Eyebrow und Ergebnis-Badge
function Step({ nr, par, title, result, resultColor, children }) {
  return (
    <div style={{ ...card, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #F2F2F4", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8E8E93", letterSpacing: "0.08em", textTransform: "uppercase" }}>Schritt {nr} · {par}</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 3 }}>{title}</div>
        </div>
        {result && (
          <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#fff", background: resultColor || "#0E0E10", borderRadius: 999, padding: "5px 12px", whiteSpace: "nowrap" }}>{result}</span>
        )}
      </div>
      {children}
    </div>
  );
}

const fmt = n => n.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("kat");

  // Kategorie
  const [crit, setCrit] = useState(Object.fromEntries(CRITERIA.map(c => [c.id, true])));
  const cat = useMemo(() => computeCategory(crit), [crit]);
  const dBrauchbar = crit.brauchbar;
  const meta = CAT_META[cat];

  // Schritt 1 – Anwendungsbereich (§1 MRG)
  const [maxZwei, setMaxZwei] = useState(false);
  const [sonstAusnahme, setSonstAusnahme] = useState(false); // Ferien-/Dienstwohnung, ≤ 6 Monate
  const [bewilligung, setBewilligung] = useState("Vor dem 1.7.1953"); // maßgeblich: Datum der BAUBEWILLIGUNG, nicht der Fertigstellung
  const [dgAusbau, setDgAusbau] = useState(false);
  const [we45, setWe45] = useState(false);

  // Schritt 2 – Mietzinssystem (§16 MRG)
  const [denkmal, setDenkmal] = useState(false);
  const [wiederaufbau, setWiederaufbau] = useState(false); // Wiederaufbau/Neuschaffung nach 8.5.1945 (§16 Abs 1 Z 1 u. 2)

  // Schritt 3 – Berechnung
  const [land, setLand] = useState("Wien");
  const [flaeche, setFlaeche] = useState(65);
  const [befristet, setBefristet] = useState(false);
  const [gutelage, setGutelage] = useState(false);
  const [grundkosten, setGrundkosten] = useState(700);
  const [marktmiete, setMarktmiete] = useState(14);

  const rw = RICHTWERTE[land];

  // ── Schritt 1: Anwendungsbereich ──────────────────────────────────────
  const anwendung = useMemo(() => {
    if (maxZwei || sonstAusnahme) return {
      stufe: "Vollausnahme", color: "#FF5C5C", norm: "§1 Abs 2 MRG",
      text: "Das MRG gilt zur Gänze nicht. Der Mietzins ist frei vereinbar; Grenzen setzen nur Wucher und Sittenwidrigkeit (§§ 879, 934 ABGB).",
    };
    if (bewilligung === "Nach 30.6.1953 · frei finanziert" || dgAusbau || we45) return {
      stufe: "Teilanwendung", color: "#F5A623", norm: "§1 Abs 4 MRG",
      text: "Es gelten nur einzelne MRG-Bestimmungen (v. a. Kündigungsschutz, Befristungen). Die Mietzinsbildung des §16 MRG gilt nicht – der Mietzins ist frei vereinbar. Maßgeblich ist stets das Datum der Baubewilligung, nicht der Fertigstellung.",
    };
    return {
      stufe: "Vollanwendung", color: "#00C48C", norm: "§1 Abs 1 MRG",
      text: "Das MRG gilt zur Gänze – typischerweise Altbau (Baubewilligung vor dem 1.7.1953) oder mit öffentlichen Mitteln (Wohnbauförderung) errichteter Neubau. Der zulässige Hauptmietzins richtet sich nach §16 MRG.",
    };
  }, [maxZwei, sonstAusnahme, bewilligung, dgAusbau, we45]);

  // ── Schritt 2: Mietzinssystem ─────────────────────────────────────────
  const system = useMemo(() => {
    if (anwendung.stufe !== "Vollanwendung") return {
      name: "Freier Mietzins", norm: anwendung.norm,
      text: anwendung.stufe === "Vollausnahme"
        ? "Keine mietrechtliche Obergrenze – marktübliche Miete zulässig."
        : "Keine Mietzinsobergrenze im Teilanwendungsbereich – marktübliche Miete zulässig. Der Befristungsabschlag gilt hier nicht.",
      frei: true,
    };
    if (wiederaufbau) return {
      name: "Angemessener Mietzins", norm: "§16 Abs 1 Z 1 u. 2 MRG",
      text: "Das Gebäude wurde aufgrund einer nach dem 8.5.1945 erteilten Baubewilligung neu errichtet bzw. die Wohnung durch Um-, Auf-, Ein- oder Zubau neu geschaffen – klassischer Fall: kriegszerstörte, mit Mitteln des Wohnhaus-Wiederaufbaufonds wiedererrichtete Häuser. Es gilt der ortsübliche („angemessene“) Mietzins statt des Richtwerts. Achtung: Bei noch aufrechter Förderung gehen förderrechtliche Mietzinsobergrenzen (WWG/WFG) vor.",
      frei: false, angemessen: true,
    };
    if (denkmal) return {
      name: "Angemessener Mietzins", norm: "§16 Abs 1 Z 3 MRG",
      text: "Denkmalgeschütztes Gebäude, in dessen Erhaltung nach dem 8.5.1945 erhebliche Eigenmittel des Vermieters geflossen sind: Es gilt der ortsübliche („angemessene“) Mietzins statt des Richtwerts.",
      frei: false, angemessen: true,
    };
    if ((cat === "A" || cat === "B") && flaeche > 130) return {
      name: "Angemessener Mietzins", norm: "§16 Abs 1 Z 4 MRG",
      text: "Kategorie-A/B-Wohnung über 130 m² Nutzfläche: Bei Wiedervermietung binnen 6 Monaten nach Räumung (18 Monate bei Verbesserungsarbeiten) gilt der angemessene, ortsübliche Mietzins.",
      frei: false, angemessen: true,
    };
    if (cat === "D") return {
      name: "Kategoriemietzins D", norm: "§16 Abs 5 MRG",
      text: `Für Kategorie-D-Wohnungen gilt der Kategoriebetrag statt des Richtwerts: € ${fmt(dBrauchbar ? KATBETRAG.Dbrauchbar : KATBETRAG.Dunbrauchbar)}/m² (D ${dBrauchbar ? "brauchbar" : "unbrauchbar"}, ab 1.4.2026).`,
      frei: false, katD: true,
    };
    return {
      name: "Richtwertmietzins", norm: "§16 Abs 2 MRG iVm RichtWG",
      text: "Ausgangspunkt ist der Richtwert des Bundeslandes für die Normwohnung (Kat. A, 30–130 m², durchschnittliche Lage). Abweichungen werden über Zu- und Abschläge sowie einen allfälligen Lagezuschlag abgebildet.",
      frei: false, richtwert: true,
    };
  }, [anwendung, wiederaufbau, denkmal, cat, flaeche, dBrauchbar]);

  // ── Schritt 3: Berechnung ─────────────────────────────────────────────
  const calc = useMemo(() => {
    const rows = [];
    let qm;
    if (system.frei || system.angemessen) {
      qm = marktmiete;
      rows.push([system.frei ? "Marktübliche Miete (Eingabe)" : "Ortsübliche Miete (Eingabe)", `€ ${fmt(marktmiete)}/m²`]);
      if (system.angemessen && befristet) { qm *= 0.75; rows.push(["− Befristungsabschlag 25 % (§16 Abs 7)", `€ ${fmt(qm)}/m²`]); }
    } else if (system.katD) {
      qm = dBrauchbar ? KATBETRAG.Dbrauchbar : KATBETRAG.Dunbrauchbar;
      rows.push([`Kategoriebetrag D ${dBrauchbar ? "brauchbar" : "unbrauchbar"}`, `€ ${fmt(qm)}/m²`]);
      if (befristet) { qm *= 0.75; rows.push(["− Befristungsabschlag 25 % (§16 Abs 7)", `€ ${fmt(qm)}/m²`]); }
    } else {
      qm = rw;
      rows.push([`Richtwert ${land} (ab 1.4.2026)`, `€ ${fmt(rw)}/m²`]);
      const abschlag = cat === "B" ? 0.25 : cat === "C" ? 0.5 : 0;
      if (abschlag) { qm *= 1 - abschlag; rows.push([`− Ausstattungsabschlag Kat. ${cat} (${abschlag * 100} %, Richtgröße)`, `€ ${fmt(qm)}/m²`]); }
      if (gutelage) {
        const lz = Math.max(0, (grundkosten - GKA[land]) * 0.00333);
        qm += lz;
        rows.push([`+ Lagezuschlag: (€ ${fmt(grundkosten)} − GKA € ${fmt(GKA[land])}) × 0,33 %`, `€ ${fmt(qm)}/m²`]);
      }
      if (befristet) { qm *= 0.75; rows.push(["− Befristungsabschlag 25 % (§16 Abs 7)", `€ ${fmt(qm)}/m²`]); }
    }
    return { qm, rows };
  }, [system, marktmiete, befristet, dBrauchbar, rw, land, cat, gutelage, grundkosten]);

  const monat = calc.qm * flaeche;

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif", color: "#0E0E10", WebkitFontSmoothing: "antialiased" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; } button { font-family: inherit; }
        .row:hover { background: #F4F4F5; }
        input:focus { border-color: #0E0E10 !important; }
        .tabs::-webkit-scrollbar { display: none; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(250,250,250,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #ECECEE" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em" }}>Mietzins-Check</div>
            <div style={{ fontSize: 12, color: "#8E8E93" }}>Kategorie · Mietzinsbildung · Erhöhung</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, background: "#0E0E10", color: "#fff", borderRadius: 999, padding: "7px 14px 7px 9px" }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: meta.color, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14, color: "#0E0E10", transition: "background .3s" }}>{cat}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>€ {fmt(monat)}/M.</span>
          </div>
        </div>
        <div className="tabs" style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px 12px", display: "flex", gap: 8, overflowX: "auto" }}>
          {[["kat", "Kategorie"], ["miete", "Mietzins"], ["erhoehung", "Erhöhung"]].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              border: "none", cursor: "pointer", borderRadius: 999, padding: "7px 15px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
              background: tab === id ? "#0E0E10" : "#EFEFF1", color: tab === id ? "#fff" : "#48484A", transition: "all .2s",
            }}>{l}</button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "22px 20px 40px" }}>

        {/* ══ TAB: KATEGORIE ══ */}
        {tab === "kat" && (<>
          <div style={{ ...card, padding: 24 }}>
            <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
              Kategorie <span style={{ color: meta.color }}>{cat}{cat === "D" ? (dBrauchbar ? " (brauchbar)" : " (unbrauchbar)") : ""}</span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 14, color: "#636366", lineHeight: 1.55 }}>{meta.desc}<Fn n={1} /><Fn n={5} /></p>
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#8E8E93", lineHeight: 1.5 }}>
              Maßgeblich ist der Zustand bei Übergabe. Fehlt ein einzelnes Merkmal, fällt die Wohnung in die nächstniedrigere Kategorie (§15a Abs 2 MRG).
            </p>
          </div>
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            {CRITERIA.map((c, i) => (
              <ToggleRow key={c.id} label={c.label} hint={c.hint} on={crit[c.id]} border={i > 0}
                onClick={() => setCrit(p => ({ ...p, [c.id]: !p[c.id] }))} />
            ))}
          </div>
        </>)}

        {/* ══ TAB: MIETZINS – Punkt für Punkt wie im Gesetz ══ */}
        {tab === "miete" && (<>

          {/* Ergebnis oben */}
          <div style={{ ...card, padding: 24, background: "#0E0E10", color: "#fff", border: "none" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9E9EA3", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {system.frei ? "Frei vereinbar · Indikation" : "Zulässiger Hauptmietzins (max.)"}
            </div>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", margin: "4px 0 2px" }}>
              € {fmt(monat)}<span style={{ fontSize: 16, color: "#9E9EA3", fontWeight: 600 }}> / Monat</span>
            </div>
            <div style={{ fontSize: 13, color: "#C7C7CC" }}>€ {fmt(calc.qm)}/m² · {flaeche} m² · {system.name} ({system.norm})</div>
          </div>

          {/* Schritt 1 */}
          <Step nr={1} par="§1 MRG" title="Anwendungsbereich" result={anwendung.stufe} resultColor={anwendung.color}>
            <div style={{ padding: "12px 18px 4px", fontSize: 11.5, fontWeight: 700, color: "#8E8E93", letterSpacing: "0.06em", textTransform: "uppercase" }}>A · Vollausnahmen (§1 Abs 2)</div>
            <ToggleRow label="Max. 2 Wohnungen im Gebäude" hint="" on={maxZwei} onClick={() => setMaxZwei(v => !v)} />
            <ToggleRow border label="Ferien-/Dienstwohnung oder ≤ 6 Monate" hint="" on={sonstAusnahme} onClick={() => setSonstAusnahme(v => !v)} />

            <div style={{ padding: "14px 18px 4px", borderTop: "1px solid #F2F2F4", fontSize: 11.5, fontWeight: 700, color: "#8E8E93", letterSpacing: "0.06em", textTransform: "uppercase" }}>B · Baubewilligung des Gebäudes</div>
            <div style={{ padding: "8px 18px 14px" }}>
              <Pills options={["Vor dem 1.7.1953", "Nach 30.6.1953 · gefördert", "Nach 30.6.1953 · frei finanziert"]} value={bewilligung} onChange={setBewilligung} />
              <p style={{ fontSize: 12, color: "#8E8E93", margin: "8px 0 0" }}>Maßgeblich ist die Erteilung der Baubewilligung, nicht die Fertigstellung.<Fn n={1} /></p>
            </div>

            <div style={{ padding: "12px 18px 4px", borderTop: "1px solid #F2F2F4", fontSize: 11.5, fontWeight: 700, color: "#8E8E93", letterSpacing: "0.06em", textTransform: "uppercase" }}>C · Teilanwendung (§1 Abs 4)</div>
            <ToggleRow label="DG-Ausbau (Bewilligung nach 2001) / Zubau (nach 2006)" hint="" on={dgAusbau} onClick={() => setDgAusbau(v => !v)} />
            <ToggleRow border label="Wohnungseigentum, Bewilligung nach 8.5.1945" hint="" on={we45} onClick={() => setWe45(v => !v)} />
          </Step>

          {/* Schritt 2 */}
          <Step nr={2} par="§16 MRG" title="Mietzinssystem" result={system.name} resultColor="#0E0E10">
            {anwendung.stufe === "Vollanwendung" && (<>
              <ToggleRow label="Wiederaufbau / Neubau nach 8.5.1945" hint="z. B. Wiederaufbaufonds-Häuser (§16 Abs 1 Z 1–2)" on={wiederaufbau} onClick={() => setWiederaufbau(v => !v)} />
              <ToggleRow border label="Denkmalschutz + erhebliche Eigenmittel" hint="§16 Abs 1 Z 3" on={denkmal} onClick={() => setDenkmal(v => !v)} />
              <div style={{ padding: "14px 18px", borderTop: "1px solid #F2F2F4", display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <label style={label13}>Nutzfläche (m²)</label>
                  <input type="number" min="10" max="500" value={flaeche} style={numInput} onChange={e => setFlaeche(Math.max(0, +e.target.value || 0))} />
                </div>
                <div>
                  <label style={label13}>Kategorie</label>
                  <div style={{ ...numInput, display: "flex", alignItems: "center", gap: 8, background: "#fff" }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: meta.color, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12 }}>{cat}</span>
                    Kategorie {cat}
                  </div>
                </div>
              </div>
            </>)}
            {anwendung.stufe !== "Vollanwendung" && (
              <div style={{ padding: "14px 18px" }}>
                <label style={label13}>Nutzfläche (m²)</label>
                <input type="number" min="10" max="500" value={flaeche} style={numInput} onChange={e => setFlaeche(Math.max(0, +e.target.value || 0))} />
              </div>
            )}
            <p style={{ fontSize: 12.5, color: "#8E8E93", margin: 0, padding: "12px 18px", borderTop: "1px solid #F2F2F4" }}>{system.name} · {system.norm}<Fn n={1} /></p>
          </Step>

          {/* Schritt 3 */}
          <Step nr={3} par={system.richtwert ? "§16 Abs 2–4, 7 MRG · RichtWG" : "§16 Abs 7 MRG"} title="Mietzins berechnen">
            {system.richtwert && (<>
              <div style={{ padding: "14px 18px" }}>
                <label style={label13}>Bundesland · Richtwert € {fmt(rw)}/m²<Fn n={2} /><Fn n={3} /></label>
                <Pills options={Object.keys(RICHTWERTE)} value={land} onChange={setLand} />
              </div>
              <ToggleRow border label="Überdurchschnittliche Lage (Lagezuschlag)" hint={`(Grundkosten − GKA € ${fmt(GKA[land])}) × 0,33 % · §16 Abs 4`} on={gutelage} onClick={() => setGutelage(v => !v)} />
              {gutelage && (
                <div style={{ padding: "0 18px 14px" }}>
                  <label style={label13}>Tatsächliche Grundkosten (€/m²)</label>
                  <input type="number" min="0" step="50" value={grundkosten} style={numInput} onChange={e => setGrundkosten(Math.max(0, +e.target.value || 0))} />
                </div>
              )}
            </>)}
            {(system.frei || system.angemessen) && (
              <div style={{ padding: "14px 18px" }}>
                <label style={label13}>{system.frei ? "Marktübliche" : "Ortsübliche"} Miete (€/m²)</label>
                <input type="number" min="0" step="0.5" value={marktmiete} style={numInput} onChange={e => setMarktmiete(Math.max(0, +e.target.value || 0))} />
              </div>
            )}
            {!system.frei && (
              <ToggleRow border={system.richtwert || system.angemessen} label="Befristeter Mietvertrag" hint="− 25 % · §16 Abs 7" on={befristet} onClick={() => setBefristet(v => !v)} />
            )}
            {/* Rechenweg */}
            <div style={{ borderTop: "1px solid #F2F2F4" }}>
              {calc.rows.map(([l, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 18px", borderTop: i ? "1px solid #F7F7F8" : "none", fontSize: 13.5 }}>
                  <span style={{ color: "#636366" }}>{l}</span>
                  <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{v}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 18px", borderTop: "1px solid #ECECEE", fontSize: 14.5, fontWeight: 700, background: "#FAFAFA" }}>
                <span>× {flaeche} m² = Hauptmietzins/Monat</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>€ {fmt(monat)}</span>
              </div>
            </div>
          </Step>

          <p style={{ fontSize: 12, color: "#8E8E93", lineHeight: 1.5 }}>
            Indikation ohne Betriebskosten/USt. Abschläge Kat. B/C sind Richtgrößen; weitere Zu-/Abschläge einzelfallbezogen.<Fn n={6} /> Keine Rechtsberatung.
          </p>
        </>)}

        {/* ══ TAB: ERHÖHUNG ══ */}
        {tab === "erhoehung" && (<>
          {[
            ["1 · Wertsicherung (Indexanpassung)", <>Voraussetzung ist eine schriftlich vereinbarte Wertsicherungsklausel (meist VPI). Die Erhöhung muss dem Mieter schriftlich und mindestens 14 Tage vor dem Zinstermin bekanntgegeben werden – rückwirkend ist sie nicht durchsetzbar (§16 Abs 9 MRG). Nach der Valorisierung zum 1.4.2026 sind Anpassungen bestehender Verträge frühestens ab Mai 2026 wirksam.<Fn n={1} /><Fn n={3} /></>],
            ["2 · Mietpreisbremse 2026–2028", <>Richtwert-, Kategorie- und WGG-Mieten dürfen 2026 um maximal 1 % und 2027 um maximal 2 % steigen. Ab 2028 darf der über 3 % liegende Teil der Inflation nur zur Hälfte weitergegeben werden – das erfasst auch den angemessenen und den frei vereinbarten Mietzins im Teilanwendungsbereich.<Fn n={4} /></>],
            ["3 · §18 MRG – Erhöhung für Erhaltungsarbeiten", <>Reichen die Hauptmietzinsreserven der letzten 10 Jahre nicht zur Finanzierung notwendiger Erhaltungsarbeiten (Dach, Leitungen, Fassade), kann der Vermieter bei der Schlichtungsstelle bzw. dem Bezirksgericht eine befristete Anhebung der Hauptmietzinse aller Mieter durchsetzen – auch über die sonstigen Obergrenzen hinaus.<Fn n={1} /></>],
            ["4 · §45 MRG – Anhebung auf den Mindestmietzins", <>Bei Altverträgen (vor 1.3.1994) mit sehr niedrigen Mieten kann der Vermieter einseitig auf den Mindestmietzins anheben: ab 1.4.2026 € 2,99 (Kat. A), € 2,25 (B), € 1,50 (C/D brauchbar) bzw. € 1,13 (D unbrauchbar) je m². Schriftliches Begehren erforderlich.<Fn n={1} /><Fn n={3} /></>],
            ["5 · Kategorieanhebung nach Standardverbesserung", <>Hebt der Vermieter die Ausstattung nachweislich an (z. B. Einbau von Bad und Heizung), gilt für neue Mietverträge die höhere Kategorie. Bei laufenden Verträgen bleibt die bei Übergabe maßgebliche Kategorie grundsätzlich bestehen.<Fn n={1} /><Fn n={5} /></>],
            ["6 · Frei vereinbarte Mieten", <>Außerhalb des Vollanwendungsbereichs sind Erhöhungen nur möglich, wenn sie vertraglich vereinbart wurden (Wertsicherungsklausel) – einseitige Erhöhungen ohne vertragliche Grundlage sind unwirksam. Die Deckelung des Inflationsanteils über 3 % gilt ab 2028 auch hier.<Fn n={4} /></>],
            ["7 · Grenzen & Rechtsschutz", <>Erhöhungen über das zulässige Maß sind teilnichtig: Mieter können den Hauptmietzins bei der Schlichtungsstelle/dem Bezirksgericht überprüfen lassen und Überzahlungen bis zu 10 Jahre zurückfordern; bei befristeten Verträgen gilt eine Präklusivfrist von 6 Monaten nach Vertragsende.<Fn n={6} /><Fn n={7} /></>],
          ].map(([t, b], i) => (
            <div key={i} style={{ ...card, padding: "20px 22px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{t}</div>
              <p style={{ margin: 0, fontSize: 13.5, color: "#48484A", lineHeight: 1.6 }}>{b}</p>
            </div>
          ))}
        </>)}

        {/* ══ FUSSNOTEN ══ */}
        <footer style={{ marginTop: 36, paddingTop: 20, borderTop: "1px solid #ECECEE" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8E8E93", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Quellen</div>
          <ol style={{ margin: 0, padding: "0 0 0 18px" }}>
            {FOOTNOTES.map(([label, url], i) => (
              <li key={i} id={"fn-" + (i + 1)} style={{ fontSize: 12, color: "#8E8E93", lineHeight: 1.5, marginBottom: 6 }}>
                <a href={url} target="_blank" rel="noreferrer" style={{ color: "#48484A", textDecoration: "none", borderBottom: "1px solid #D9D9DE" }}>{label}</a>
              </li>
            ))}
          </ol>
          <p style={{ fontSize: 11.5, color: "#AEAEB2", marginTop: 14, lineHeight: 1.5 }}>
            Alle Beträge: Stand 1. April 2026. Diese Anwendung dient der Orientierung und ersetzt keine Rechtsberatung.
          </p>
        </footer>
      </main>
    </div>
  );
}
