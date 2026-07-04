import React, { useState, useMemo, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import {
  collection, doc, onSnapshot, addDoc, updateDoc, setDoc, deleteDoc,
} from "firebase/firestore";
import { auth, db, googleProvider, memberRole } from "./firebase.js";
import {
  Heart, X, Check, Plus, MapPin, Phone, Calendar, ArrowLeft,
  Home, Settings, Link2, Scale, ChevronRight, Archive, RotateCcw, Ruler, Tag,
  ClipboardList, Trash2, Building2, ChevronDown, Clock,
} from "lucide-react";

// ── Design tokens ───────────────────────────────────────────────
const C = {
  paper: "#EFEDE6",
  card: "#FFFFFF",
  ink: "#2B2536",
  inkSoft: "#736C80",
  inkFaint: "#A49DAE",
  line: "#E5E0D7",
  anais: "#DB6B54",
  anaisSoft: "#FAE9E3",
  copine: "#2E8B80",
  copineSoft: "#DFEFEC",
  gold: "#B8892F",
  goldSoft: "#F4EAD3",
  archived: "#8C8796",
};

// ── Pipeline stages ─────────────────────────────────────────────
const ORDER = ["tri", "valide", "contacte", "planifie", "visite", "decide"];
const STAGE = {
  tri:      { label: "À trier",          dot: C.inkFaint },
  valide:   { label: "Validé à deux",    dot: C.copine },
  contacte: { label: "Agence contactée", dot: "#6E8FD6" },
  planifie: { label: "Visite prévue",    dot: "#6E8FD6" },
  visite:   { label: "Visité",           dot: C.gold },
  decide:   { label: "Offre lancée",     dot: C.gold },
  archive:  { label: "Archivé",          dot: C.archived },
};

// ── Portails d'annonces ─────────────────────────────────────────
const SITE = {
  "SeLoger":    { bg: "#E4EEFB", fg: "#1C5FA8" },
  "Leboncoin":  { bg: "#FCE9D6", fg: "#BF5F16" },
  "PAP":        { bg: "#E4F1E2", fg: "#3B7A34" },
  "Bien'ici":   { bg: "#F6E6EE", fg: "#A6396C" },
  "Logic-Immo": { bg: "#ECE8F8", fg: "#5A4B9C" },
  "Orpi":       { bg: "#FBE7E7", fg: "#B23636" },
  "Century 21": { bg: "#FBEFD8", fg: "#8A6210" },
  "Autre":      { bg: "#EEECE4", fg: "#6E6779" },
};
const SITE_OPTIONS = ["SeLoger", "Leboncoin", "PAP", "Bien'ici", "Logic-Immo", "Orpi", "Century 21", "Autre"];
const siteStyle = (name) => SITE[name] || SITE["Autre"];
function detectSite(url = "") {
  const u = url.toLowerCase();
  if (u.includes("seloger")) return "SeLoger";
  if (u.includes("leboncoin")) return "Leboncoin";
  if (u.includes("pap.")) return "PAP";
  if (u.includes("bienici")) return "Bien'ici";
  if (u.includes("logic-immo")) return "Logic-Immo";
  if (u.includes("orpi")) return "Orpi";
  if (u.includes("century21")) return "Century 21";
  return u.trim() ? "Autre" : "";
}

// ── Nos critères (texte libre, partagé) ─────────────────────────
const DEFAULT_CRITERIA =
  "• Budget max : 420 000 €\n" +
  "• Minimum 2 chambres (ou 1 chambre + bureau)\n" +
  "• Un extérieur (balcon / terrasse) = gros plus\n" +
  "• Lumineux, pas de RDC sur rue passante\n" +
  "• Proche d'un métro (ligne 9 ou 2 idéalement)\n" +
  "• Cuisine séparée de préférence\n" +
  "• Quartier vivant mais au calme le soir";

// ── Modèle de questions de visite ───────────────────────────────
const DEFAULT_CHECKLIST = [
  { id: "c1", name: "Immeuble & copropriété", questions: [
    { id: "q_age", text: "Âge du bâtiment ?" },
    { id: "q_travaux", text: "Date des derniers gros travaux ?" },
    { id: "q_toiture", text: "Date rénovation toiture / ravalement ?" },
    { id: "q_charges", text: "Montant des charges ? Ce qu'elles couvrent ?" },
    { id: "q_dette", text: "Copropriété endettée ? Impayés de copropriétaires ?" },
    { id: "q_justice", text: "Actions en justice en cours ?" },
    { id: "q_votes", text: "Travaux votés ?" },
    { id: "q_nonvotes", text: "Travaux prévus non encore votés ?" },
    { id: "q_refaire", text: "Ravalement / toiture / ascenseur / chaudière à refaire ?" },
    { id: "q_pbs", text: "Problèmes récurrents ? (bruit, intrusions, caves…)" },
  ]},
  { id: "c2", name: "Énergie & charges", questions: [
    { id: "q_dpe", text: "Classement DPE ?" },
    { id: "q_elec", text: "Électricité / plomberie refaites quand ?" },
    { id: "q_chauff", text: "Chauffage collectif ou individuel ? Coût ?" },
    { id: "q_sinistre", text: "Infiltrations / dégâts des eaux / sinistres ?" },
    { id: "q_eau", text: "Coût de l'eau ?" },
    { id: "q_conso", text: "Conso électrique des occupants (facture) ?" },
    { id: "q_taxe", text: "Montant de la taxe foncière ?" },
    { id: "q_vitrage", text: "Fenêtres double vitrage ?" },
    { id: "q_orient", text: "Orientation ?" },
    { id: "q_surface", text: "Surfaces mesurées officiellement (loi Carrez) ?" },
  ]},
  { id: "c3", name: "Raisons de la vente", questions: [
    { id: "q_pourquoi", text: "Pourquoi la vente ? Depuis combien de temps ?" },
    { id: "q_prop", text: "Propriétaire seul ? Litige avec d'autres ?" },
    { id: "q_offres", text: "Des offres déjà refusées ?" },
    { id: "q_prix", text: "Le prix a-t-il déjà baissé ?" },
  ]},
  { id: "c4", name: "Parties communes & annexes", questions: [
    { id: "q_secu", text: "Sécurité de l'entrée ?" },
    { id: "q_cave", text: "Cave ?" },
    { id: "q_parking", text: "Parking ?" },
    { id: "q_velo", text: "Local vélos ?" },
    { id: "q_poubelle", text: "Local poubelles ?" },
    { id: "q_bal", text: "Boîtes aux lettres ?" },
    { id: "q_gardien", text: "Gardien ?" },
  ]},
  { id: "c5", name: "Urbanisme & risques", questions: [
    { id: "q_permis", text: "Permis de construire à proximité ?" },
    { id: "q_transports", text: "Nouveaux transports prévus ?" },
    { id: "q_risque", text: "Zone de risque ? (inondation, terrain, argiles)" },
  ]},
];

// ── Seed data ───────────────────────────────────────────────────
const SEED = [
  {
    id: 1, title: "2 pièces lumineux", area: "Bastille", url: "seloger.com",
    agency: "Foncia Nation",
    notes: "Plein est, très clair le matin. Cuisine séparée, cave incluse. Charges ~140 €/mois. À 3 min du métro Bastille.",
    price: 342000, surface: 44, rooms: 2, addedBy: "anais", status: "tri",
    avis: { anais: { like: true, comment: "Coup de cœur, la lumière du matin !" }, copine: { like: null, comment: "" } },
    archiveReason: "", agence: { calledBy: null, slots: [] },
    debrief: { anais: "", copine: "" }, ratings: { anais: 0, copine: 0 },
  },
  {
    id: 2, title: "3 pièces avec balcon", area: "Charonne", url: "seloger.com",
    agency: "Agence du Marais", exterior: "Balcon",
    notes: "Balcon plein sud. Refait en 2021, rien à prévoir. Copro saine, 24 lots. Étage élevé avec ascenseur.",
    price: 398000, surface: 58, rooms: 3, addedBy: "copine", status: "valide",
    avis: { anais: { like: true, comment: "Le balcon change tout." }, copine: { like: true, comment: "Cuisine à refaire mais gros potentiel." } },
    archiveReason: "", agence: { calledBy: null, slots: [] },
    debrief: { anais: "", copine: "" }, ratings: { anais: 0, copine: 0 },
  },
  {
    id: 3, title: "Studio refait à neuf", area: "Nation", url: "leboncoin.fr",
    price: 289000, surface: 33, rooms: 1, addedBy: "anais", status: "contacte",
    avis: { anais: { like: true, comment: "Petit mais nickel." }, copine: { like: true, comment: "Trop petit pour nous deux à terme ?" } },
    archiveReason: "", agence: { calledBy: "anais", slots: ["2026-07-05T15:00", "2026-07-06T18:30"] },
    debrief: { anais: "", copine: "" }, ratings: { anais: 0, copine: 0 },
  },
  {
    id: 4, title: "3 pièces sur cour", area: "Père-Lachaise", url: "seloger.com",
    agency: "Foncia Nation",
    price: 431000, surface: 62, rooms: 3, addedBy: "copine", status: "planifie",
    avis: { anais: { like: true, comment: "Calme, j'adore." }, copine: { like: true, comment: "" } },
    archiveReason: "", agence: { calledBy: "copine", assignedTo: "copine", slots: ["2026-07-02T12:00", "2026-07-06T11:00"], visitAt: "2026-07-06T11:00" },
    debrief: { anais: "", copine: "" }, ratings: { anais: 0, copine: 0 },
  },
  {
    id: 5, title: "2 pièces atypique", area: "Ménilmontant", url: "pap.fr",
    price: 355000, surface: 49, rooms: 2, addedBy: "anais", status: "visite",
    avis: { anais: { like: true, comment: "" }, copine: { like: true, comment: "" } },
    archiveReason: "", agence: { calledBy: "anais", slots: ["2026-07-01T17:00"], visitAt: "2026-07-01T17:00" },
    debrief: { anais: "Poutres superbes, mais 3e sans ascenseur.", copine: "Chambre un peu sombre. À comparer avec Charonne." },
    ratings: { anais: 4, copine: 3 },
    answers: { q_age: "Immeuble des années 1930", q_charges: "180 €/mois (ascenseur + espaces verts)", q_dpe: "D", q_orient: "Sud-ouest, très clair l'après-midi", q_vitrage: "Oui, double vitrage récent" },
  },
  {
    id: 6, title: "2 pièces RDC", area: "Oberkampf", url: "leboncoin.fr",
    price: 312000, surface: 41, rooms: 2, addedBy: "copine", status: "archive",
    avis: { anais: { like: false, comment: "Sombre et sur rue passante." }, copine: { like: false, comment: "" } },
    archiveReason: "RDC sur rue bruyante, aucune lumière.",
    agence: { calledBy: null, slots: [] },
    debrief: { anais: "", copine: "" }, ratings: { anais: 0, copine: 0 },
  },
  {
    id: 7, title: "2 pièces rénové", area: "Voltaire", url: "seloger.com",
    agency: "Agence du Marais",
    price: 372000, surface: 46, rooms: 2, addedBy: "anais", status: "valide",
    avis: { anais: { like: true, comment: "Très bien refait." }, copine: { like: true, comment: "Cuisine ouverte, top." } },
    archiveReason: "", agence: { calledBy: null, slots: [] },
    debrief: { anais: "", copine: "" }, ratings: { anais: 0, copine: 0 },
  },
  {
    id: 8, title: "3 pièces traversant", area: "République", url: "seloger.com",
    agency: "Century 21 République",
    price: 445000, surface: 64, rooms: 3, addedBy: "copine", status: "planifie",
    avis: { anais: { like: true, comment: "Très beau volume." }, copine: { like: true, comment: "" } },
    archiveReason: "", agence: { calledBy: "anais", assignedTo: "anais", slots: ["2026-07-04T10:00", "2026-07-05T14:00"], visitAt: "2026-07-05T14:00" },
    debrief: { anais: "", copine: "" }, ratings: { anais: 0, copine: 0 },
  },
];

const euro = (n) => n.toLocaleString("fr-FR") + " €";
const externalUrl = (u) => {
  const s = (u || "").trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : "https://" + s;
};
const fmtVisit = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};
const fmtVisitLong = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) +
    " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};
const gcalStamp = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
};
const gcalLink = (b, emails) => {
  if (!b.agence.visitAt) return "#";
  const start = new Date(b.agence.visitAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Visite — ${b.title}${b.area ? " (" + b.area + ")" : ""}`,
    dates: `${gcalStamp(start)}/${gcalStamp(end)}`,
  });
  if (b.area) params.set("location", b.area);
  const details = [b.notes, b.url ? "Annonce : " + externalUrl(b.url) : "", b.agency ? "Agence : " + b.agency : ""].filter(Boolean).join("\n");
  if (details) params.set("details", details);
  const guests = [emails.anais, emails.copine].filter(Boolean).join(",");
  if (guests) params.set("add", guests);
  return "https://calendar.google.com/calendar/render?" + params.toString();
};

function Household({ me, email }) {
  const { biens, criteria, checklist, settings, loading } = useHousehold();
  const names = settings.names;
  const emails = settings.emails;
  const other = me === "anais" ? "copine" : "anais";
  const [filter, setFilter] = useState("tous");
  const [agencyFilter, setAgencyFilter] = useState("");
  const [openId, setOpenId] = useState(null);
  const [view, setView] = useState("feed"); // feed | compare | criteres
  const [adding, setAdding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const meColor = me === "anais" ? C.anais : C.copine;

  // ── Écritures Firestore ────────────────────────────────────────
  const update = (id, patch) => updateDoc(doc(db, "biens", String(id)), patch);
  const addBien = (nb) => addDoc(collection(db, "biens"), nb);

  const setAnswer = (bienId, qId, val) =>
    updateDoc(doc(db, "biens", String(bienId)), { ["answers." + qId]: val });

  const saveChecklist = (categories) => setDoc(doc(db, "shared", "checklist"), { categories });
  const addQuestion = (catId, text) =>
    saveChecklist(checklist.map((c) => (c.id === catId ? { ...c, questions: [...c.questions, { id: "q" + Date.now(), text }] } : c)));
  const deleteQuestion = (catId, qId) =>
    saveChecklist(checklist.map((c) => (c.id === catId ? { ...c, questions: c.questions.filter((q) => q.id !== qId) } : c)));
  const addCategory = (name) =>
    saveChecklist([...checklist, { id: "c" + Date.now(), name, questions: [] }]);
  const deleteCategory = (catId) =>
    saveChecklist(checklist.filter((c) => c.id !== catId));

  const saveCriteria = (text) => setDoc(doc(db, "shared", "criteria"), { text });
  const saveNames = (n) => setDoc(doc(db, "shared", "settings"), { names: n }, { merge: true });
  const saveEmails = (e) => setDoc(doc(db, "shared", "settings"), { emails: e }, { merge: true });

  const assignCaller = (ids, who) =>
    ids.forEach((id) => updateDoc(doc(db, "biens", String(id)), { "agence.assignedTo": who }));
  const markCalled = (slotsById, caller) =>
    Object.keys(slotsById).forEach((id) =>
      updateDoc(doc(db, "biens", id), { status: "contacte", "agence.calledBy": caller, "agence.slots": slotsById[id] }));

  const seedDemo = async () => {
    if (biens.length) return;
    for (const b of SEED) {
      const { id, ...rest } = b;
      const m = { answers: {}, agency: "", exterior: "", notes: "", site: detectSite(rest.url), ...rest };
      await addDoc(collection(db, "biens"), { ...m, agence: { slots: [], ...m.agence } });
    }
    await saveCriteria(DEFAULT_CRITERIA);
    await saveChecklist(DEFAULT_CHECKLIST);
  };

  const logout = () => signOut(auth);

  // Renseigne automatiquement l'e-mail de la personne connectée (une seule fois, si vide).
  useEffect(() => {
    if (!loading && email && !emails[me]) {
      saveEmails({ ...emails, [me]: email });
    }
  }, [loading, email, emails, me]);

  const FILTERS = [
    { key: "tous", label: "Tous" },
    { key: "tri", label: "À trier" },
    { key: "valide", label: "Validés" },
    { key: "contacte", label: "Créneau à valider" },
    { key: "planifie", label: "RDV validés" },
    { key: "visite", label: "Visités" },
    { key: "archive", label: "Archivés" },
  ];

  const agencies = useMemo(
    () => [...new Set(biens.map((b) => b.agency).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [biens]);

  const shown = useMemo(() => {
    const list = biens.filter((b) => {
      const okAgency = !agencyFilter || b.agency === agencyFilter;
      if (!okAgency) return false;
      if (filter === "tous") return b.status !== "archive";
      if (filter === "visite") return b.status === "visite" || b.status === "decide";
      return b.status === filter;
    });
    if (filter === "planifie") {
      list.sort((a, b) => (a.agence.visitAt || "").localeCompare(b.agence.visitAt || ""));
    }
    return list;
  }, [biens, filter, agencyFilter]);

  const counts = useMemo(() => {
    const triNeedsMe = biens.filter(
      (b) => b.status === "tri" && b.avis[me].like === null
    ).length;
    return { total: biens.filter((b) => b.status !== "archive").length, triNeedsMe };
  }, [biens, me]);

  const opened = biens.find((b) => b.id === openId);

  if (loading) return <Splash text="Chargement de vos biens…" />;

  return (
    <div style={{ background: C.paper, color: C.ink, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
         className="w-full flex justify-center py-4">
      <div className="w-full max-w-md relative" style={{ minHeight: 720 }}>

        {/* Header */}
        <div className="px-5 pt-2 pb-3">
          <div className="flex items-start justify-between">
            <div>
              <h1 style={{ fontFamily: "Georgia, serif", fontSize: 26, lineHeight: 1.05, letterSpacing: "-0.5px" }}>
                Chez nous&nbsp;?
              </h1>
              <p style={{ color: C.inkSoft, fontSize: 13, marginTop: 4 }}>
                {counts.total} biens en course
                {counts.triNeedsMe > 0 && (
                  <span style={{ color: meColor, fontWeight: 500 }}>
                    {" · "}{counts.triNeedsMe} attend{counts.triNeedsMe > 1 ? "ent" : ""} ton avis
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowSettings((s) => !s)}
                style={{ color: C.inkSoft }} className="p-1.5" aria-label="Réglages">
                <Settings size={18} />
              </button>
              <span className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1"
                style={{ background: C.card, border: `1px solid ${C.line}` }}>
                <Avatar who={me} names={names} size={26} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{names[me]}</span>
              </span>
            </div>
          </div>

          {showSettings && (
            <SettingsPanel names={names} emails={emails}
              onSaveNames={saveNames} onSaveEmails={saveEmails}
              canSeed={biens.length === 0} onSeed={seedDemo} onLogout={logout} />
          )}
        </div>

        {/* View switch */}
        <div className="px-5 flex gap-2 mb-3">
          {[["feed", "Les biens", Home], ["compare", "Comparer", Scale], ["criteres", "Critères", ClipboardList]].map(([k, lbl, Icon]) => (
            <button key={k} onClick={() => setView(k)}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5"
              style={{
                fontSize: 13, fontWeight: 500,
                background: view === k ? C.ink : "transparent",
                color: view === k ? "#fff" : C.inkSoft,
                border: `1px solid ${view === k ? C.ink : C.line}`,
              }}>
              <Icon size={14} /> {lbl}
            </button>
          ))}
        </div>

        {view === "feed" && (
          <>
            {/* À contacter (biens validés, groupés par agence) */}
            <CallList biens={biens} names={names} me={me}
              onAssign={assignCaller} onCalled={markCalled} onOpenBien={setOpenId} />

            {/* Filter chips */}
            <div className="px-5 flex gap-2 overflow-x-auto pb-3" style={{ scrollbarWidth: "none" }}>
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    className="whitespace-nowrap rounded-full px-3 py-1.5"
                    style={{
                      fontSize: 12.5, fontWeight: active ? 500 : 400,
                      background: active ? C.ink : C.card,
                      color: active ? "#fff" : C.inkSoft,
                      border: `1px solid ${active ? C.ink : C.line}`,
                    }}>
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Agency filter */}
            {agencies.length > 0 && (
              <div className="px-5 mb-3 flex items-center gap-2">
                <Building2 size={15} color={agencyFilter ? meColor : C.inkSoft} />
                <div className="flex-1 rounded-lg px-3 py-2 flex items-center"
                  style={{ border: `1px solid ${agencyFilter ? meColor : C.line}`, background: C.card }}>
                  <select value={agencyFilter}
                    onChange={(e) => { const v = e.target.value; setAgencyFilter(v); if (v) setFilter("tous"); }}
                    className="flex-1 outline-none"
                    style={{ fontSize: 13.5, background: "transparent", color: agencyFilter ? C.ink : C.inkSoft }}>
                    <option value="">Toutes les agences</option>
                    {agencies.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                {agencyFilter && (
                  <button onClick={() => setAgencyFilter("")} style={{ color: C.inkSoft }} aria-label="Effacer le filtre agence">
                    <X size={16} />
                  </button>
                )}
              </div>
            )}

            {/* Add button (compact) + agency count */}
            <div className="px-5 mb-3 flex items-center justify-between gap-3">
              <span style={{ fontSize: 12.5, color: C.inkSoft }}>
                {agencyFilter
                  ? <>{shown.length} bien{shown.length > 1 ? "s" : ""} chez <b style={{ color: C.ink }}>{agencyFilter}</b></>
                  : <>{shown.length} bien{shown.length > 1 ? "s" : ""}</>}
              </span>
              <button onClick={() => { setShowSettings(false); setAdding(true); }}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 whitespace-nowrap"
                style={{ fontSize: 13, fontWeight: 500, color: meColor, background: C.card, border: `1px solid ${meColor}` }}>
                <Plus size={15} /> Ajouter un bien
              </button>
            </div>

            {/* Cards */}
            <div className="px-5 pb-24 space-y-3">
              {shown.length === 0 && (
                <div className="text-center py-16" style={{ color: C.inkFaint, fontSize: 14 }}>
                  Rien ici pour l'instant.
                </div>
              )}
              {shown.map((b) => (
                <Card key={b.id} b={b} names={names} me={me} onOpen={() => setOpenId(b.id)} />
              ))}
            </div>
          </>
        )}

        {view === "compare" && <Compare biens={biens} names={names} />}

        {view === "criteres" && (
          <CriteriaView criteria={criteria} onSaveCriteria={saveCriteria} checklist={checklist}
            onAddQuestion={addQuestion} onDeleteQuestion={deleteQuestion}
            onAddCategory={addCategory} onDeleteCategory={deleteCategory} />
        )}

        {/* Detail */}
        {opened && (
          <Detail b={opened} names={names} me={me} other={other} emails={emails}
            onClose={() => setOpenId(null)} update={update}
            checklist={checklist} onAnswer={(qid, val) => setAnswer(opened.id, qid, val)}
            onAddQuestion={addQuestion} />
        )}

        {/* Add */}
        {adding && (
          <AddSheet me={me} names={names} onClose={() => setAdding(false)}
            onAdd={(nb) => { addBien(nb); setAdding(false); }} />
        )}
      </div>
    </div>
  );
}

// ── Avatar ──────────────────────────────────────────────────────
function initials(name) {
  const n = (name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n[0].toUpperCase() + (n[1] ? n[1].toLowerCase() : "");
}

function Avatar({ who, names, size = 24 }) {
  const bg = who === "anais" ? C.anais : C.copine;
  const label = initials(names[who]);
  return (
    <span style={{ width: size, height: size, background: bg, color: "#fff",
      borderRadius: "50%", display: "inline-flex", alignItems: "center",
      justifyContent: "center", fontSize: size * (label.length > 1 ? 0.36 : 0.44),
      fontWeight: 600, letterSpacing: label.length > 1 ? "-0.02em" : 0 }}>
      {label}
    </span>
  );
}

// ── Avis pill ───────────────────────────────────────────────────
function AvisPill({ who, avis, names }) {
  const { like } = avis;
  const color = who === "anais" ? C.anais : C.copine;
  let icon, txt, faint = false;
  if (like === true) { icon = <Heart size={12} fill={color} color={color} />; txt = "aime"; }
  else if (like === false) { icon = <X size={12} color={C.archived} />; txt = "non"; faint = true; }
  else { icon = <span style={{ fontSize: 12, color: C.inkFaint }}>?</span>; txt = "en attente"; faint = true; }
  return (
    <span className="inline-flex items-center gap-1" style={{ fontSize: 11.5, color: faint ? C.inkFaint : color }}>
      <Avatar who={who} names={names} size={16} />
      {icon} {txt}
    </span>
  );
}

// ── Card ────────────────────────────────────────────────────────
function Card({ b, names, me, onOpen }) {
  const st = STAGE[b.status];
  const needsMe = b.status === "tri" && b.avis[me].like === null;
  const ss = siteStyle(b.site);
  return (
    <button onClick={onOpen} className="w-full text-left rounded-2xl overflow-hidden"
      style={{ background: C.card, border: `1px solid ${needsMe ? (me === "anais" ? C.anais : C.copine) : C.line}` }}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1" style={{ fontSize: 11.5, color: C.inkFaint }}>
            trouvé par <Avatar who={b.addedBy} names={names} size={16} />
          </span>
          <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: C.inkSoft }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot, display: "inline-block" }} />
            {st.label}
          </span>
        </div>

        {b.site && (
          <div className="mb-2.5">
            <span style={{ background: ss.bg, color: ss.fg, fontSize: 11.5, fontWeight: 500, padding: "2px 9px", borderRadius: 999 }}>{b.site}</span>
          </div>
        )}

        <div className="flex items-baseline justify-between gap-3">
          <h3 style={{ fontSize: 16, fontWeight: 500 }}>{b.title}</h3>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 18, whiteSpace: "nowrap" }}>{euro(b.price)}</span>
        </div>

        <div className="flex items-center gap-1.5 mt-1" style={{ fontSize: 12.5, color: b.agency ? C.inkSoft : C.inkFaint }}>
          <Building2 size={13} /> <span>{b.agency || "Particulier"}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1" style={{ fontSize: 12.5, color: C.inkSoft }}>
          <span className="inline-flex items-center gap-1"><MapPin size={13} />{b.area}</span>
          <span className="inline-flex items-center gap-1"><Ruler size={13} />{b.surface} m²</span>
          <span>{b.rooms} {b.rooms > 1 ? "pièces" : "pièce"}</span>
          {b.exterior && <span style={{ color: C.copine, fontWeight: 500 }}>{b.exterior}</span>}
          <span style={{ color: C.inkFaint }}>{Math.round(b.price / b.surface).toLocaleString("fr-FR")} €/m²</span>
        </div>

        {b.notes && (
          <p className="mt-2" style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.45,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {b.notes}
          </p>
        )}

        {b.status === "planifie" && b.agence.visitAt && (
          <div className="inline-flex items-center gap-1.5 mt-2.5 rounded-lg px-2.5 py-1"
            style={{ fontSize: 12, fontWeight: 500, background: "#E6F0FB", color: "#1C5FA8" }}>
            <Calendar size={13} /> {fmtVisit(b.agence.visitAt)}
          </div>
        )}
        {b.status === "contacte" && (
          <div className="inline-flex items-center gap-1.5 mt-2.5" style={{ fontSize: 12, color: "#BA7517" }}>
            <Clock size={13} /> Créneau à valider
          </div>
        )}

        <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <AvisPill who="anais" avis={b.avis.anais} names={names} />
          <AvisPill who="copine" avis={b.avis.copine} names={names} />
          <ChevronRight size={16} color={C.inkFaint} style={{ marginLeft: "auto" }} />
        </div>

        {needsMe && (
          <div className="mt-2 rounded-lg px-2.5 py-1.5" style={{
            fontSize: 12, fontWeight: 500,
            background: me === "anais" ? C.anaisSoft : C.copineSoft,
            color: me === "anais" ? C.anais : C.copine }}>
            À toi de donner ton avis
          </div>
        )}
      </div>
    </button>
  );
}

// ── Stepper ─────────────────────────────────────────────────────
function Stepper({ status }) {
  if (status === "archive") return null;
  const idx = ORDER.indexOf(status);
  return (
    <div className="flex items-center gap-1.5 mt-3">
      {ORDER.map((s, i) => (
        <div key={s} className="flex-1" style={{ height: 4, borderRadius: 2,
          background: i <= idx ? STAGE[status].dot : C.line }} />
      ))}
    </div>
  );
}

// ── Detail ──────────────────────────────────────────────────────
function Detail({ b, names, me, other, emails, onClose, update, checklist, onAnswer, onAddQuestion }) {
  const st = STAGE[b.status];
  const setAvis = (comment, like) =>
    update(b.id, { avis: { ...b.avis, [me]: { like: like ?? b.avis[me].like, comment: comment ?? b.avis[me].comment } } });

  const [reason, setReason] = useState("");
  const [comment, setComment] = useState(b.avis[me].comment || "");
  const [notes, setNotes] = useState(b.notes || "");
  const [archiving, setArchiving] = useState(false);
  const [slots, setSlots] = useState(b.agence.slots || []);
  const [confirmAt, setConfirmAt] = useState(b.agence.visitAt || "");
  const [debrief, setDebrief] = useState(b.debrief[me]);

  const bothLike = b.avis.anais.like === true && b.avis.copine.like === true;

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto mx-auto" style={{ background: C.paper, maxWidth: "28rem" }}>
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{ background: C.paper, borderBottom: `1px solid ${C.line}` }}>
        <button onClick={onClose} style={{ color: C.ink }}><ArrowLeft size={22} /></button>
        <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13, color: C.inkSoft }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot, display: "inline-block" }} />
          {st.label}
        </span>
      </div>

      <div className="px-5 py-4 pb-28">
        <div className="flex items-baseline justify-between gap-3">
          <h2 style={{ fontSize: 22, fontWeight: 500 }}>{b.title}</h2>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 22, whiteSpace: "nowrap" }}>{euro(b.price)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2" style={{ fontSize: 13.5, color: C.inkSoft }}>
          <span className="inline-flex items-center gap-1"><MapPin size={14} />{b.area}</span>
          <span className="inline-flex items-center gap-1"><Ruler size={14} />{b.surface} m²</span>
          <span>{b.rooms} pièces</span>
          {b.exterior && <span style={{ color: C.copine, fontWeight: 500 }}>{b.exterior}</span>}
          <span className="inline-flex items-center gap-1" style={{ color: C.inkFaint }}>
            <Tag size={13} />{Math.round(b.price / b.surface).toLocaleString("fr-FR")} €/m²
          </span>
        </div>

        <div className="flex items-center gap-2 mt-2.5">
          {b.site && (
            <span style={{ background: siteStyle(b.site).bg, color: siteStyle(b.site).fg,
              fontSize: 11.5, fontWeight: 500, padding: "2px 9px", borderRadius: 999 }}>{b.site}</span>
          )}
          <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12.5, color: b.agency ? C.inkSoft : C.inkFaint }}>
            <Building2 size={13} /> {b.agency || "Particulier"}
          </span>
        </div>

        {b.url && (
          <a href={externalUrl(b.url)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2"
            style={{ fontSize: 13, color: me === "anais" ? C.anais : C.copine }}>
            <Link2 size={14} /> Voir l'annonce
          </a>
        )}

        {b.status === "planifie" && (
          <div className="mt-2.5">
            <a href={gcalLink(b, emails)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
              style={{ fontSize: 12.5, fontWeight: 500, background: "#E6F0FB", color: "#1C5FA8", textDecoration: "none" }}>
              <Calendar size={13} /> Ajouter au Google Agenda
            </a>
          </div>
        )}

        <Stepper status={b.status} />

        {/* Infos clés (visibles sur la page d'accueil) */}
        <div className="mt-5">
          <label style={{ fontSize: 13, color: C.inkSoft, fontWeight: 500 }}>Infos clés</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            onBlur={() => { if (notes !== (b.notes || "")) update(b.id, { notes }); }}
            placeholder="2-3 lignes qui résument le bien — s'affichent sur la page d'accueil"
            rows={3} className="w-full rounded-lg px-3 py-2 outline-none resize-none mt-1.5"
            style={{ fontSize: 13.5, lineHeight: 1.5, border: `1px solid ${C.line}`, background: C.card }} />
        </div>

        {/* Avis des deux */}
        <h4 style={{ fontSize: 13, color: C.inkSoft, marginTop: 22, marginBottom: 10, fontWeight: 500 }}>Vos avis</h4>
        <div className="space-y-3">
          {["anais", "copine"].map((who) => {
            const isMe = who === me;
            const col = who === "anais" ? C.anais : C.copine;
            const soft = who === "anais" ? C.anaisSoft : C.copineSoft;
            const a = b.avis[who];
            return (
              <div key={who} className="rounded-2xl p-3.5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2" style={{ fontSize: 14, fontWeight: 500 }}>
                    <Avatar who={who} names={names} size={22} /> {names[who]}
                    {isMe && <span style={{ fontSize: 11, color: C.inkFaint }}>(toi)</span>}
                  </span>
                  {isMe ? (
                    <div className="flex gap-1.5">
                      <button onClick={() => setAvis(null, true)}
                        className="flex items-center gap-1 rounded-full px-3 py-1"
                        style={{ fontSize: 12.5, fontWeight: 500,
                          background: a.like === true ? col : soft,
                          color: a.like === true ? "#fff" : col }}>
                        <Heart size={13} fill={a.like === true ? "#fff" : "none"} /> J'aime
                      </button>
                      <button onClick={() => setAvis(null, false)}
                        className="flex items-center gap-1 rounded-full px-3 py-1"
                        style={{ fontSize: 12.5, fontWeight: 500,
                          background: a.like === false ? C.archived : "#F1EFEA",
                          color: a.like === false ? "#fff" : C.inkSoft }}>
                        <X size={13} /> Non
                      </button>
                    </div>
                  ) : (
                    <AvisPill who={who} avis={a} names={names} />
                  )}
                </div>
                {isMe ? (
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                    onBlur={() => { if (comment !== (a.comment || "")) setAvis(comment, null); }}
                    placeholder="Un commentaire ? Ce qui te plaît, ce qui te freine…"
                    className="w-full mt-2.5 rounded-lg px-3 py-2 outline-none resize-none"
                    rows={2} style={{ fontSize: 13.5, border: `1px solid ${C.line}`, background: C.paper }} />
                ) : (
                  a.comment ? <p style={{ fontSize: 13.5, color: C.ink, marginTop: 8 }}>« {a.comment} »</p>
                    : <p style={{ fontSize: 13, color: C.inkFaint, marginTop: 8 }}>Pas encore de commentaire.</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Fiche de visite (dès que la visite est prévue) */}
        {(b.status === "planifie" || b.status === "visite" || b.status === "decide") && (
          <VisitForm checklist={checklist} answers={b.answers || {}}
            onAnswer={onAnswer} onAddQuestion={onAddQuestion} />
        )}

        {/* Actions selon l'étape */}
        <div className="mt-6">
          {b.status === "tri" && (
            <>
              {bothLike ? (
                <Btn full color={C.copine} onClick={() => update(b.id, { status: "valide" })}>
                  <Check size={17} /> On est d'accord — valider à deux
                </Btn>
              ) : (
                <p style={{ fontSize: 13, color: C.inkSoft, textAlign: "center", marginBottom: 12 }}>
                  Il manque un « j'aime » des deux côtés pour valider.
                </p>
              )}
            </>
          )}

          {b.status === "valide" && (
            <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
              <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Contacter l'agence</p>

              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 13, color: C.inkSoft }}>Qui appelle ?</span>
                {["anais", "copine"].map((who) => {
                  const active = b.agence.assignedTo === who;
                  const wcol = who === "anais" ? C.anais : C.copine;
                  const wsoft = who === "anais" ? C.anaisSoft : C.copineSoft;
                  return (
                    <button key={who}
                      onClick={() => update(b.id, { agence: { ...b.agence, assignedTo: who } })}
                      className="inline-flex items-center gap-1 rounded-full pl-1 pr-2.5 py-1"
                      style={{ fontSize: 12.5, fontWeight: 500,
                        background: active ? wcol : wsoft, color: active ? "#fff" : wcol }}>
                      <Avatar who={who} names={names} size={18} /> {names[who]}
                    </button>
                  );
                })}
              </div>

              <label style={{ fontSize: 12, color: C.inkSoft }}>Créneaux proposés par l'agence (jusqu'à 3)</label>
              <div className="mt-1.5 mb-3">
                <SlotEditor value={slots} onChange={setSlots} />
              </div>
              <Btn full color={C.gold} disabled={!slots.some((s) => s)}
                onClick={() => update(b.id, { status: "contacte", agence: { ...b.agence, calledBy: b.agence.assignedTo || me, slots: slots.filter(Boolean) } })}>
                <Phone size={16} /> J'ai appelé — enregistrer les créneaux
              </Btn>
            </div>
          )}

          {b.status === "contacte" && (
            <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
              <div className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 mb-3"
                style={{ fontSize: 12, fontWeight: 500, background: "#FAEEDA", color: "#BA7517" }}>
                <Clock size={13} /> En attente de validation du créneau
              </div>
              <p style={{ fontSize: 13, color: C.inkSoft }}>
                Appelé par <b style={{ color: C.ink }}>{names[b.agence.calledBy] || "—"}</b>
              </p>
              <p style={{ fontSize: 12, color: C.inkSoft, marginTop: 10, marginBottom: 6 }}>
                Créneaux proposés — choisis-en un :
              </p>
              <div className="flex flex-col gap-2 mb-3">
                {(b.agence.slots || []).filter(Boolean).length === 0 && (
                  <span style={{ fontSize: 13, color: C.inkFaint }}>Aucun créneau enregistré.</span>
                )}
                {(b.agence.slots || []).filter(Boolean).map((s) => {
                  const active = confirmAt === s;
                  return (
                    <button key={s} onClick={() => setConfirmAt(s)}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-left"
                      style={{ fontSize: 13.5, fontWeight: active ? 500 : 400,
                        background: active ? "#E6F0FB" : C.paper,
                        color: active ? "#1C5FA8" : C.ink,
                        border: `1px solid ${active ? "#378ADD" : C.line}` }}>
                      {active ? <Check size={15} /> : <Clock size={15} color={C.inkFaint} />}
                      {fmtVisitLong(s)}
                    </button>
                  );
                })}
              </div>
              <label style={{ fontSize: 12, color: C.inkSoft }}>Date et heure retenues</label>
              <input type="datetime-local" value={confirmAt} onChange={(e) => setConfirmAt(e.target.value)}
                className="w-full rounded-lg px-3 py-2 outline-none mb-3 mt-1"
                style={{ fontSize: 14, border: `1px solid ${C.line}`, background: C.paper }} />
              <Btn full color="#378ADD" disabled={!confirmAt}
                onClick={() => update(b.id, { status: "planifie", agence: { ...b.agence, visitAt: confirmAt } })}>
                <Calendar size={16} /> Valider le rendez-vous
              </Btn>
            </div>
          )}

          {b.status === "planifie" && (
            <div className="rounded-2xl p-4 mb-3" style={{ background: "#E6F0FB", border: "1px solid #B5D4F4" }}>
              <p className="inline-flex items-center gap-2" style={{ fontSize: 14, fontWeight: 500, color: "#1C5FA8" }}>
                <Calendar size={16} /> Visite {fmtVisitLong(b.agence.visitAt)}
              </p>
            </div>
          )}
          {b.status === "planifie" && (
            <Btn full color={C.gold} onClick={() => update(b.id, { status: "visite" })}>
              <Check size={16} /> On a visité — passer au débrief
            </Btn>
          )}

          {(b.status === "visite" || b.status === "decide") && (
            <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
              <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Débrief après visite</p>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 13, color: C.inkSoft }}>Ta note :</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => update(b.id, { ratings: { ...b.ratings, [me]: n } })}>
                    <Heart size={20} fill={n <= b.ratings[me] ? (me === "anais" ? C.anais : C.copine) : "none"}
                      color={n <= b.ratings[me] ? (me === "anais" ? C.anais : C.copine) : C.inkFaint} />
                  </button>
                ))}
              </div>
              <textarea value={debrief} onChange={(e) => setDebrief(e.target.value)}
                onBlur={() => update(b.id, { debrief: { ...b.debrief, [me]: debrief } })}
                placeholder="Tes impressions à chaud…"
                className="w-full rounded-lg px-3 py-2 outline-none resize-none mb-2"
                rows={2} style={{ fontSize: 13.5, border: `1px solid ${C.line}`, background: C.paper }} />
              {b.debrief[other] && (
                <p style={{ fontSize: 13, color: C.inkSoft, marginBottom: 12 }}>
                  {names[other]} : « {b.debrief[other]} »
                </p>
              )}
              {b.status === "visite" && (
                <Btn full color={C.gold} onClick={() => update(b.id, { status: "decide" })}>
                  On se lance — faire une offre
                </Btn>
              )}
              {b.status === "decide" && (
                <div className="rounded-lg px-3 py-2.5 text-center" style={{ background: C.goldSoft, color: C.gold, fontWeight: 500, fontSize: 14 }}>
                  Offre lancée. Croisons les doigts.
                </div>
              )}
            </div>
          )}

          {b.status === "archive" && (
            <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
              <p style={{ fontSize: 13, color: C.inkSoft, marginBottom: 4 }}>Archivé — raison :</p>
              <p style={{ fontSize: 14, marginBottom: 14 }}>« {b.archiveReason || "non précisée"} »</p>
              <Btn full color={C.inkSoft} onClick={() => update(b.id, { status: "tri", archiveReason: "" })}>
                <RotateCcw size={15} /> Le remettre en course
              </Btn>
            </div>
          )}

          {/* Archiver — dispo à toute étape sauf déjà archivé */}
          {b.status !== "archive" && (
            <div className="mt-3">
              {archiving ? (
                <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
                  <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="Pourquoi on l'écarte ?"
                    className="w-full rounded-lg px-3 py-2 outline-none mb-3"
                    style={{ fontSize: 14, border: `1px solid ${C.line}`, background: C.paper }} />
                  <div className="flex gap-2">
                    <Btn color={C.archived} onClick={() => update(b.id, { status: "archive", archiveReason: reason })}>
                      Archiver
                    </Btn>
                    <button onClick={() => setArchiving(false)}
                      style={{ fontSize: 13.5, color: C.inkSoft }} className="px-3">Annuler</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setArchiving(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5"
                  style={{ fontSize: 13.5, color: C.inkSoft }}>
                  <Archive size={15} /> Archiver ce bien
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Button ──────────────────────────────────────────────────────
function Btn({ children, color, full, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={"inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 " + (full ? "w-full" : "")}
      style={{ fontSize: 14, fontWeight: 500, background: disabled ? C.line : color,
        color: disabled ? C.inkFaint : "#fff", opacity: disabled ? 0.7 : 1 }}>
      {children}
    </button>
  );
}

// ── Compare ─────────────────────────────────────────────────────
function Compare({ biens, names }) {
  const visited = biens.filter((b) => b.status === "visite" || b.status === "decide");
  if (visited.length === 0)
    return <div className="px-5 py-16 text-center" style={{ color: C.inkFaint, fontSize: 14 }}>
      Aucun bien visité à comparer pour l'instant.
    </div>;
  return (
    <div className="px-5 pb-24">
      <p style={{ fontSize: 13, color: C.inkSoft, marginBottom: 12 }}>
        Les biens que vous avez visités, côte à côte.
      </p>
      <div className="space-y-3">
        {visited.map((b) => (
          <div key={b.id} className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
            <div className="flex items-baseline justify-between">
              <h3 style={{ fontSize: 15, fontWeight: 500 }}>{b.title} · {b.area}</h3>
              <span style={{ fontFamily: "Georgia, serif", fontSize: 16 }}>{euro(b.price)}</span>
            </div>
            <div className="flex gap-4 mt-1" style={{ fontSize: 12.5, color: C.inkSoft }}>
              <span>{b.surface} m²</span>
              <span>{Math.round(b.price / b.surface).toLocaleString("fr-FR")} €/m²</span>
              <span>{b.rooms} pièces</span>
            </div>
            <div className="flex gap-5 mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
              {["anais", "copine"].map((who) => (
                <div key={who} className="flex items-center gap-1.5">
                  <Avatar who={who} names={names} size={18} />
                  <span className="flex">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Heart key={n} size={13}
                        fill={n <= b.ratings[who] ? (who === "anais" ? C.anais : C.copine) : "none"}
                        color={n <= b.ratings[who] ? (who === "anais" ? C.anais : C.copine) : C.inkFaint} />
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Add sheet ───────────────────────────────────────────────────
function AddSheet({ me, names, onClose, onAdd }) {
  const [f, setF] = useState({ title: "", area: "", price: "", surface: "", rooms: "", url: "", site: "", agency: "", exterior: "", notes: "" });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const onUrl = (e) => { const url = e.target.value; setF((s) => ({ ...s, url, site: detectSite(url) || s.site })); };
  const valid = f.price && f.surface;
  const col = me === "anais" ? C.anais : C.copine;
  const ss = siteStyle(f.site);

  const submit = () => {
    const rooms = Number(f.rooms) || 1;
    const title = f.title.trim() || `${rooms} ${rooms > 1 ? "pièces" : "pièce"}${f.area ? " · " + f.area : ""}`;
    onAdd({
      title, area: f.area || "—", url: f.url.trim(), site: f.site || detectSite(f.url),
      agency: f.agency.trim(), exterior: f.exterior, notes: f.notes.trim(),
      price: Number(f.price) || 0, surface: Number(f.surface) || 0, rooms,
      addedBy: me, status: "tri",
      avis: { anais: { like: me === "anais" ? true : null, comment: "" },
              copine: { like: me === "copine" ? true : null, comment: "" } },
      archiveReason: "", agence: { calledBy: null, slots: [] },
      debrief: { anais: "", copine: "" }, ratings: { anais: 0, copine: 0 }, answers: {},
    });
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
      <div className="w-full max-w-md rounded-t-3xl p-5 pb-8 overflow-y-auto" style={{ background: C.paper, maxHeight: "90vh" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontSize: 18, fontWeight: 500, fontFamily: "Georgia, serif" }}>Nouveau bien</h3>
          <button onClick={onClose}><X size={22} color={C.inkSoft} /></button>
        </div>

        {/* Lien d'abord — détection auto du site */}
        <label className="block">
          <span style={{ fontSize: 12, color: C.inkSoft }}>Lien de l'annonce</span>
          <div className="flex items-center gap-2 mt-1 rounded-lg px-3 py-2"
            style={{ border: `1px solid ${C.line}`, background: C.card }}>
            <Link2 size={15} color={C.inkFaint} />
            <input value={f.url} onChange={onUrl} placeholder="Colle l'URL (SeLoger, Leboncoin, PAP…)"
              className="flex-1 outline-none" style={{ fontSize: 14, background: "transparent" }} />
            {f.site && (
              <span style={{ background: ss.bg, color: ss.fg, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                {f.site}
              </span>
            )}
          </div>
        </label>

        <p style={{ fontSize: 11.5, color: C.inkFaint, marginTop: 12, marginBottom: 14 }} className="inline-flex items-center gap-1.5">
          <Avatar who={me} names={names} size={16} /> Trouvé par {names[me]} — tu aimes déjà, {names[me === "anais" ? "copine" : "anais"]} donnera son avis.
        </p>

        <div className="space-y-2.5">
          <div className="flex gap-2.5">
            <Field label="Prix (€)" v={f.price} onChange={set("price")} ph="350000" num />
            <Field label="Surface (m²)" v={f.surface} onChange={set("surface")} ph="45" num />
            <Field label="Pièces" v={f.rooms} onChange={set("rooms")} ph="2" num />
          </div>
          <Field label="Ville / quartier" v={f.area} onChange={set("area")} ph="Bastille, Paris 11e" />
          <Field label="Titre (optionnel)" v={f.title} onChange={set("title")} ph="Laisse vide → généré tout seul" />

          <div className="flex gap-2.5">
            <label className="block flex-1">
              <span style={{ fontSize: 12, color: C.inkSoft }}>Site</span>
              <select value={f.site} onChange={set("site")}
                className="w-full rounded-lg px-3 py-2 outline-none mt-1"
                style={{ fontSize: 14, border: `1px solid ${C.line}`, background: C.card, color: f.site ? C.ink : C.inkFaint }}>
                <option value="">—</option>
                {SITE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <Field label="Agence (vide si particulier)" v={f.agency} onChange={set("agency")} ph="Foncia…" />
          </div>

          <div>
            <span style={{ fontSize: 12, color: C.inkSoft }}>Extérieur</span>
            <div className="flex gap-2 mt-1.5">
              {["", "Balcon", "Terrasse", "Jardin"].map((x) => {
                const active = f.exterior === x;
                return (
                  <button key={x || "none"} onClick={() => setF((s) => ({ ...s, exterior: x }))}
                    className="rounded-full px-3 py-1.5"
                    style={{ fontSize: 12.5, fontWeight: active ? 500 : 400,
                      background: active ? C.copine : C.card,
                      color: active ? "#fff" : C.inkSoft,
                      border: `1px solid ${active ? C.copine : C.line}` }}>
                    {x || "Aucun"}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span style={{ fontSize: 12, color: C.inkSoft }}>Infos clés (optionnel)</span>
            <textarea value={f.notes} onChange={set("notes")}
              placeholder="2-3 lignes qui résument le bien — visibles sur la page d'accueil"
              rows={3} className="w-full rounded-lg px-3 py-2 outline-none resize-none mt-1"
              style={{ fontSize: 13.5, lineHeight: 1.5, border: `1px solid ${C.line}`, background: C.card }} />
          </label>
        </div>

        <button onClick={submit} disabled={!valid}
          className="w-full rounded-full py-3 mt-5"
          style={{ fontSize: 15, fontWeight: 500, background: valid ? col : C.line,
            color: valid ? "#fff" : C.inkFaint }}>
          Ajouter au tri
        </button>
      </div>
    </div>
  );
}

function Field({ label, v, onChange, ph, num }) {
  return (
    <label className="block flex-1">
      <span style={{ fontSize: 12, color: C.inkSoft }}>{label}</span>
      <input value={v} onChange={onChange} placeholder={ph} inputMode={num ? "numeric" : "text"}
        className="w-full rounded-lg px-3 py-2 outline-none mt-1"
        style={{ fontSize: 14, border: `1px solid ${C.line}`, background: C.card }} />
    </label>
  );
}

// ── Saisie de créneaux proposés (jusqu'à 3 dates/heures) ────────
function SlotEditor({ value, onChange }) {
  const rows = value.length ? value : [""];
  const setAt = (i, v) => { const c = rows.slice(); c[i] = v; onChange(c); };
  const add = () => onChange([...rows, ""]);
  const removeAt = (i) => { const c = rows.filter((_, j) => j !== i); onChange(c.length ? c : [""]); };
  return (
    <div className="space-y-1.5">
      {rows.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="datetime-local" value={s || ""} onChange={(e) => setAt(i, e.target.value)}
            className="flex-1 rounded-lg px-3 py-1.5 outline-none"
            style={{ fontSize: 13, border: `1px solid ${C.line}`, background: C.paper }} />
          {rows.length > 1 && (
            <button onClick={() => removeAt(i)} style={{ color: C.inkFaint }} aria-label="Retirer ce créneau">
              <X size={15} />
            </button>
          )}
        </div>
      ))}
      {rows.length < 3 && (
        <button onClick={add} className="inline-flex items-center gap-1" style={{ fontSize: 12.5, color: C.inkFaint }}>
          <Plus size={13} /> Ajouter un créneau
        </button>
      )}
    </div>
  );
}

// ── Fiche de visite (réponses par bien) ─────────────────────────
function VisitForm({ checklist, answers, onAnswer, onAddQuestion }) {
  const [openCat, setOpenCat] = useState(null);
  const [draft, setDraft] = useState("");
  const [local, setLocal] = useState(answers);
  const total = checklist.reduce((n, c) => n + c.questions.length, 0);
  const filled = checklist.reduce(
    (n, c) => n + c.questions.filter((q) => (answers[q.id] || "").trim()).length, 0);
  return (
    <div className="rounded-2xl p-4 mt-6" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between mb-1">
        <p className="inline-flex items-center gap-2" style={{ fontSize: 14, fontWeight: 500 }}>
          <ClipboardList size={16} /> Fiche de visite
        </p>
        <span style={{ fontSize: 12, color: C.inkFaint }}>{filled}/{total} remplies</span>
      </div>
      {checklist.map((cat) => (
        <div key={cat.id} className="mt-3.5">
          <p style={{ fontSize: 12.5, fontWeight: 500, color: cat.questions.length ? C.inkSoft : C.inkFaint }}>
            {cat.name}
          </p>
          <div className="space-y-2 mt-1.5">
            {cat.questions.map((q) => (
              <div key={q.id}>
                <label style={{ fontSize: 13, color: C.ink }}>{q.text}</label>
                <input value={local[q.id] || ""} onChange={(e) => setLocal((m) => ({ ...m, [q.id]: e.target.value }))}
                  onBlur={() => { if ((local[q.id] || "") !== (answers[q.id] || "")) onAnswer(q.id, local[q.id] || ""); }}
                  placeholder="Réponse notée sur place…"
                  className="w-full rounded-lg px-3 py-1.5 outline-none mt-1"
                  style={{ fontSize: 13.5, border: `1px solid ${C.line}`, background: C.paper }} />
              </div>
            ))}
          </div>
          {openCat === cat.id ? (
            <div className="flex gap-2 mt-2">
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder="Nouvelle question…"
                className="flex-1 rounded-lg px-3 py-1.5 outline-none"
                style={{ fontSize: 13, border: `1px solid ${C.line}`, background: C.paper }} />
              <button onClick={() => { if (draft.trim()) { onAddQuestion(cat.id, draft.trim()); setDraft(""); setOpenCat(null); } }}
                style={{ fontSize: 13, color: C.copine, fontWeight: 500 }} className="px-2">Ajouter</button>
            </div>
          ) : (
            <button onClick={() => { setOpenCat(cat.id); setDraft(""); }}
              className="inline-flex items-center gap-1 mt-2" style={{ fontSize: 12.5, color: C.inkFaint }}>
              <Plus size={13} /> question
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Vue Critères (texte libre + modèle de questions) ────────────
function CriteriaView({ criteria, onSaveCriteria, checklist, onAddQuestion, onDeleteQuestion, onAddCategory, onDeleteCategory }) {
  const [newCat, setNewCat] = useState("");
  const [openCat, setOpenCat] = useState(null);
  const [draft, setDraft] = useState("");
  const [critDraft, setCritDraft] = useState(criteria);
  useEffect(() => { setCritDraft(criteria); }, [criteria]);
  return (
    <div className="px-5 pb-24">
      <div className="rounded-2xl p-4 mb-5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Ce qu'on cherche</p>
        <textarea value={critDraft} onChange={(e) => setCritDraft(e.target.value)}
          onBlur={() => { if (critDraft !== criteria) onSaveCriteria(critDraft); }} rows={8}
          className="w-full rounded-lg px-3 py-2 outline-none resize-none"
          style={{ fontSize: 13.5, lineHeight: 1.65, border: `1px solid ${C.line}`, background: C.paper }} />
        <p style={{ fontSize: 11.5, color: C.inkFaint, marginTop: 6 }}>Partagé toutes les deux, en temps réel. La saisie s'enregistre quand tu quittes le champ.</p>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <ClipboardList size={16} color={C.inkSoft} />
        <p style={{ fontSize: 14, fontWeight: 500 }}>Questions à poser en visite</p>
      </div>
      <p style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 12 }}>
        Ce modèle se retrouve dans la fiche de chaque bien à visiter.
      </p>

      <div className="space-y-3">
        {checklist.map((cat) => (
          <div key={cat.id} className="rounded-2xl p-3.5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 13.5, fontWeight: 500 }}>{cat.name}</p>
              <button onClick={() => onDeleteCategory(cat.id)} style={{ color: C.inkFaint }} aria-label="Supprimer la catégorie">
                <Trash2 size={14} />
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {cat.questions.map((q) => (
                <div key={q.id} className="flex items-center justify-between gap-2">
                  <span style={{ fontSize: 13, color: C.ink }}>· {q.text}</span>
                  <button onClick={() => onDeleteQuestion(cat.id, q.id)} style={{ color: C.inkFaint }} aria-label="Supprimer la question">
                    <X size={13} />
                  </button>
                </div>
              ))}
              {cat.questions.length === 0 && <p style={{ fontSize: 12.5, color: C.inkFaint }}>Aucune question pour l'instant.</p>}
            </div>
            {openCat === cat.id ? (
              <div className="flex gap-2 mt-2.5">
                <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                  placeholder="Nouvelle question…"
                  className="flex-1 rounded-lg px-3 py-1.5 outline-none"
                  style={{ fontSize: 13, border: `1px solid ${C.line}`, background: C.paper }} />
                <button onClick={() => { if (draft.trim()) { onAddQuestion(cat.id, draft.trim()); setDraft(""); setOpenCat(null); } }}
                  style={{ fontSize: 13, color: C.copine, fontWeight: 500 }} className="px-2">Ajouter</button>
              </div>
            ) : (
              <button onClick={() => { setOpenCat(cat.id); setDraft(""); }}
                className="inline-flex items-center gap-1 mt-2.5" style={{ fontSize: 12.5, color: C.inkFaint }}>
                <Plus size={13} /> question
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <input value={newCat} onChange={(e) => setNewCat(e.target.value)}
          placeholder="Nouvelle catégorie…"
          className="flex-1 rounded-lg px-3 py-2 outline-none"
          style={{ fontSize: 13.5, border: `1px solid ${C.line}`, background: C.card }} />
        <button onClick={() => { if (newCat.trim()) { onAddCategory(newCat.trim()); setNewCat(""); } }}
          className="rounded-lg px-4" style={{ fontSize: 13.5, fontWeight: 500, color: "#fff", background: C.ink }}>
          Ajouter
        </button>
      </div>
    </div>
  );
}
// ── À contacter (liste des biens validés, groupés par agence) ───
function CallList({ biens, names, me, onAssign, onCalled, onOpenBien }) {
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState(false);
  const toContact = biens.filter((b) => b.status === "valide");
  if (toContact.length === 0) return null;

  const groups = [];
  const map = {};
  toContact.forEach((b) => {
    const key = b.agency || `part_${b.id}`;
    if (!map[key]) { map[key] = { key, label: b.agency || b.title, isAgency: !!b.agency, biens: [] }; groups.push(map[key]); }
    map[key].biens.push(b);
  });
  const assignedTo = (g) => g.biens[0].agence.assignedTo || null;
  const mineCount = toContact.filter((b) => (b.agence.assignedTo || null) === me).length;
  const visible = mine ? groups.filter((g) => assignedTo(g) === me) : groups;

  return (
    <div className="px-5 mb-3">
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3">
          <span className="inline-flex items-center gap-2" style={{ fontSize: 14, fontWeight: 500 }}>
            <Phone size={16} color={C.gold} /> À contacter
            <span style={{ fontSize: 12, fontWeight: 500, color: C.gold, background: C.goldSoft, padding: "1px 8px", borderRadius: 999 }}>
              {toContact.length}
            </span>
            {mineCount > 0 && (
              <span style={{ fontSize: 12, color: C.inkSoft }}>· {mineCount} pour {names[me]}</span>
            )}
          </span>
          <ChevronDown size={18} color={C.inkSoft}
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        </button>

        {open && (
          <div className="px-4 pb-1 pt-1 flex gap-2" style={{ borderTop: `1px solid ${C.line}` }}>
            {[["all", "Toutes"], ["mine", `Pour ${names[me]}`]].map(([k, lbl]) => {
              const active = (k === "mine") === mine;
              return (
                <button key={k} onClick={() => setMine(k === "mine")}
                  className="rounded-full px-3 py-1 mt-2"
                  style={{ fontSize: 12.5, fontWeight: active ? 500 : 400,
                    background: active ? (me === "anais" ? C.anais : C.copine) : C.paper,
                    color: active ? "#fff" : C.inkSoft,
                    border: `1px solid ${active ? (me === "anais" ? C.anais : C.copine) : C.line}` }}>
                  {lbl}
                </button>
              );
            })}
          </div>
        )}

        {open && visible.length === 0 && (
          <div className="px-4 py-5 text-center" style={{ fontSize: 13, color: C.inkFaint }}>
            Aucune agence ne t'est attribuée pour l'instant.
          </div>
        )}
        {open && visible.map((g) => (
          <CallGroup key={g.key} g={g} names={names} me={me}
            onAssign={onAssign} onCalled={onCalled} onOpenBien={onOpenBien} />
        ))}
      </div>
    </div>
  );
}

function CallGroup({ g, names, me, onAssign, onCalled, onOpenBien }) {
  const ids = g.biens.map((b) => b.id);
  const assigned = g.biens[0].agence.assignedTo || null;
  const [slotsMap, setSlotsMap] = useState(() =>
    Object.fromEntries(g.biens.map((b) => [b.id, (b.agence.slots && b.agence.slots.length ? b.agence.slots : [])])));
  const anySlot = Object.values(slotsMap).some((arr) => (arr || []).some((s) => s));
  return (
    <div className="px-4 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13.5, fontWeight: 500 }}>
          <Building2 size={13} color={C.inkSoft} /> {g.isAgency ? g.label : `${g.label} (particulier)`}
        </span>
        <span className="inline-flex items-center gap-2">
          {assigned && (
            <span className="inline-flex items-center gap-1" style={{ fontSize: 11.5, color: assigned === "anais" ? C.anais : C.copine }}>
              <Avatar who={assigned} names={names} size={16} /> appelle
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: C.gold, background: C.goldSoft, padding: "1px 8px", borderRadius: 999 }}>
            {g.biens.length} bien{g.biens.length > 1 ? "s" : ""}
          </span>
        </span>
      </div>
      <div className="space-y-2 mt-2">
        {g.biens.map((b) => (
          <div key={b.id} className="rounded-xl p-2.5" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
            <button onClick={() => onOpenBien(b.id)} className="w-full text-left flex items-center justify-between gap-2">
              <span>
                <span className="block" style={{ fontSize: 13.5, fontWeight: 500 }}>{b.title}</span>
                <span className="block mt-0.5" style={{ fontSize: 12, color: C.inkSoft }}>
                  {b.area} · {b.surface} m² · {b.rooms}p{b.exterior ? " · " + b.exterior : ""}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5" style={{ whiteSpace: "nowrap" }}>
                <span style={{ fontFamily: "Georgia, serif", fontSize: 14 }}>{euro(b.price)}</span>
                <ChevronRight size={15} color={C.inkFaint} />
              </span>
            </button>
            <div className="mt-2">
              <span style={{ fontSize: 11.5, color: C.inkSoft }}>Créneaux proposés (jusqu'à 3)</span>
              <div className="mt-1">
                <SlotEditor value={slotsMap[b.id] || []} onChange={(arr) => setSlotsMap((m) => ({ ...m, [b.id]: arr }))} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span style={{ fontSize: 12.5, color: C.inkSoft }}>Qui appelle ?</span>
        {["anais", "copine"].map((who) => {
          const active = assigned === who;
          const wcol = who === "anais" ? C.anais : C.copine;
          const wsoft = who === "anais" ? C.anaisSoft : C.copineSoft;
          return (
            <button key={who} onClick={() => onAssign(ids, who)}
              className="inline-flex items-center gap-1 rounded-full pl-1 pr-2.5 py-1"
              style={{ fontSize: 12.5, fontWeight: 500, background: active ? wcol : wsoft, color: active ? "#fff" : wcol }}>
              <Avatar who={who} names={names} size={18} /> {names[who]}
            </button>
          );
        })}
      </div>

      <button disabled={!anySlot} onClick={() => onCalled(
          Object.fromEntries(Object.entries(slotsMap).map(([id, arr]) => [id, (arr || []).filter(Boolean)])),
          assigned || me)}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 mt-3"
        style={{ fontSize: 13.5, fontWeight: 500, background: anySlot ? C.gold : C.line,
          color: anySlot ? "#fff" : C.inkFaint }}>
        <Phone size={15} /> J'ai appelé — enregistrer les créneaux
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Authentification + données Firestore
// ═══════════════════════════════════════════════════════════════

function normalizeBien(b) {
  return {
    answers: {}, agency: "", exterior: "", notes: "", site: detectSite(b.url || ""),
    ...b,
    avis: { anais: { like: null, comment: "" }, copine: { like: null, comment: "" }, ...(b.avis || {}) },
    debrief: { anais: "", copine: "", ...(b.debrief || {}) },
    ratings: { anais: 0, copine: 0, ...(b.ratings || {}) },
    agence: { slots: [], ...(b.agence || {}) },
  };
}

function useAuth() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); }), []);
  return { user, ready };
}

function useHousehold() {
  const [biens, setBiens] = useState([]);
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST);
  const [settings, setSettings] = useState({
    names: { anais: "Anaïs", copine: "Audrey" }, emails: { anais: "", copine: "" },
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsubs = [];
    unsubs.push(onSnapshot(collection(db, "biens"), (snap) => {
      setBiens(snap.docs.map((d) => normalizeBien({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (e) => { console.error(e); setLoading(false); }));
    unsubs.push(onSnapshot(doc(db, "shared", "criteria"), (d) => {
      if (d.exists() && typeof d.data().text === "string") setCriteria(d.data().text);
    }));
    unsubs.push(onSnapshot(doc(db, "shared", "checklist"), (d) => {
      if (d.exists() && Array.isArray(d.data().categories)) setChecklist(d.data().categories);
    }));
    unsubs.push(onSnapshot(doc(db, "shared", "settings"), (d) => {
      if (d.exists()) setSettings((s) => ({
        names: { ...s.names, ...(d.data().names || {}) },
        emails: { ...s.emails, ...(d.data().emails || {}) },
      }));
    }));
    return () => unsubs.forEach((u) => u());
  }, []);
  return { biens, criteria, checklist, settings, loading };
}

function Splash({ text }) {
  return (
    <div style={{ background: C.paper, color: C.inkSoft, minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: 14 }}>
      {text}
    </div>
  );
}

function Login() {
  const [err, setErr] = useState("");
  const go = async () => {
    setErr("");
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { setErr("Connexion impossible : " + (e?.code || e?.message || "erreur")); }
  };
  return (
    <div style={{ background: C.paper, color: C.ink, minHeight: "100vh", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
      className="flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 30, letterSpacing: "-0.5px" }}>Chez nous&nbsp;?</h1>
        <p style={{ color: C.inkSoft, fontSize: 14, marginTop: 8, marginBottom: 24 }}>
          Votre recherche d'appartement, à deux.
        </p>
        <button onClick={go} className="w-full rounded-full py-3"
          style={{ fontSize: 15, fontWeight: 500, background: C.ink, color: "#fff" }}>
          Se connecter avec Google
        </button>
        {err && <p style={{ color: C.anais, fontSize: 12.5, marginTop: 12 }}>{err}</p>}
      </div>
    </div>
  );
}

function NotAllowed({ email, onLogout }) {
  return (
    <div style={{ background: C.paper, color: C.ink, minHeight: "100vh", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
      className="flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>Accès non autorisé</h2>
        <p style={{ color: C.inkSoft, fontSize: 13.5, marginTop: 8 }}>
          Le compte <b style={{ color: C.ink }}>{email}</b> n'est pas reconnu. Ajoute cet e-mail dans
          {" "}src/firebase.js (MEMBERS) et dans les règles Firestore.
        </p>
        <button onClick={onLogout} className="rounded-full px-4 py-2 mt-5"
          style={{ fontSize: 13.5, fontWeight: 500, border: `1px solid ${C.line}`, background: C.card, color: C.ink }}>
          Changer de compte
        </button>
      </div>
    </div>
  );
}

function SettingsPanel({ names, emails, onSaveNames, onSaveEmails, canSeed, onSeed, onLogout }) {
  const [n, setN] = useState(names);
  const [em, setEm] = useState(emails);
  useEffect(() => setN(names), [names]);
  useEffect(() => setEm(emails), [emails]);
  return (
    <div className="mt-3 p-3 rounded-2xl" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <p style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8 }}>Vos prénoms</p>
      <div className="flex gap-2">
        {["anais", "copine"].map((k) => (
          <input key={k} value={n[k] || ""} onChange={(ev) => setN((s) => ({ ...s, [k]: ev.target.value }))}
            onBlur={() => { if (n[k] !== names[k]) onSaveNames(n); }}
            className="flex-1 rounded-lg px-3 py-2 outline-none"
            style={{ border: `1px solid ${C.line}`, fontSize: 14, borderLeft: `3px solid ${k === "anais" ? C.anais : C.copine}` }} />
        ))}
      </div>
      <p style={{ fontSize: 12, color: C.inkSoft, margin: "12px 0 8px" }}>Vos e-mails (invitations Google Agenda)</p>
      <div className="space-y-2">
        {["anais", "copine"].map((k) => (
          <input key={k} type="email" value={em[k] || ""} placeholder={`E-mail de ${names[k]}`}
            onChange={(ev) => setEm((s) => ({ ...s, [k]: ev.target.value }))}
            onBlur={() => { if (em[k] !== emails[k]) onSaveEmails(em); }}
            className="w-full rounded-lg px-3 py-2 outline-none"
            style={{ border: `1px solid ${C.line}`, fontSize: 14, borderLeft: `3px solid ${k === "anais" ? C.anais : C.copine}` }} />
        ))}
      </div>
      <div className="flex items-center justify-between mt-4">
        {canSeed
          ? <button onClick={onSeed} style={{ fontSize: 12.5, fontWeight: 500, color: C.copine }}>Charger des exemples</button>
          : <span />}
        <button onClick={onLogout} style={{ fontSize: 12.5, color: C.inkSoft }}>Se déconnecter</button>
      </div>
    </div>
  );
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <Splash text="Connexion…" />;
  if (!user) return <Login />;
  const role = memberRole(user.email);
  if (!role) return <NotAllowed email={user.email} onLogout={() => signOut(auth)} />;
  return <Household me={role} email={user.email} />;
}
