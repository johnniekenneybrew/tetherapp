import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TODAY, MONTHS, Icon, Checkbox, AccountDot } from './shared';

// ============================================================
// Social — Contacts page
// ============================================================

const formatBirthday = (bday) => {
  if (!bday) return "—";
  const d = new Date(bday + "T00:00:00");
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
};

const fmtBday = (bday) => {
  if (!bday) return "—";
  const d = new Date(bday + "T00:00:00");
  const year = d.getFullYear();
  if (year === 2000) return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${year}`;
};

const daysUntilBirthday = (bday) => {
  if (!bday) return Infinity;
  const d = new Date(bday + "T00:00:00");
  const next = new Date(TODAY.getFullYear(), d.getMonth(), d.getDate());
  if (next < TODAY) next.setFullYear(next.getFullYear() + 1);
  return Math.round((next - TODAY) / (1000 * 60 * 60 * 24));
};

const fmtTimestamp = (iso) => {
  if (!iso) return "";
  // Date-only strings (from old notes) — show just date, no bogus time
  const hasTime = iso.includes("T");
  const d = new Date(hasTime ? iso : iso + "T12:00:00");
  const mo = MONTHS[d.getMonth()].slice(0, 3);
  const day = d.getDate();
  if (!hasTime) return `${mo} ${day}`;
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${mo} ${day} · ${h % 12 || 12}:${m} ${ampm}`;
};

export function SocialPage({ state, setState, actions }) {
  const [groupFilter, setGroupFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showManageGroups, setShowManageGroups] = useState(false);
  const [search, setSearch] = useState("");

  const groups = state.contactGroups || [];
  const contacts = state.contacts || [];

  const allTags = useMemo(() => {
    const set = new Set();
    contacts.forEach((c) => (c.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [contacts]);

  const filtered = contacts.filter((c) => {
    const matchGroup = groupFilter === "all" || (c.groups || []).includes(groupFilter);
    const matchTag = !tagFilter || (c.tags || []).includes(tagFilter);
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.city || "").toLowerCase().includes(search.toLowerCase());
    return matchGroup && matchTag && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));

  return (
    <div className="page fade-in">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 className="page-title">Social</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            {contacts.length} contacts · {groups.length} groups
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => setShowManageGroups(true)}>Manage groups</button>
          <button className="btn btn-primary" onClick={() => setShowAddContact(true)}>
            <Icon.Plus /> Add contact
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div className="filter-row">
          <button className={"filter-btn" + (groupFilter === "all" ? " is-active" : "")} onClick={() => setGroupFilter("all")}>All</button>
          {groups.map((g) => (
            <button key={g.id} className={"filter-btn" + (groupFilter === g.id ? " is-active" : "")} onClick={() => setGroupFilter(g.id)}>
              {g.icon ? <span style={{ marginRight: 4 }}>{g.icon}</span> : null}{g.name}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <input className="input" style={{ maxWidth: 220, padding: "7px 12px", fontSize: 13 }}
          placeholder="Search contacts…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          <span className="tiny" style={{ marginRight: 4 }}>Tags</span>
          {allTags.map((tag) => (
            <button key={tag} className={"tag-filter" + (tagFilter === tag ? " is-active" : "")}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}>{tag}</button>
          ))}
          {tagFilter && <button className="btn-text" style={{ fontSize: 12 }} onClick={() => setTagFilter(null)}>Clear</button>}
        </div>
      )}

      {/* Birthday banner */}
      {(() => {
        const upcoming = contacts
          .filter((c) => c.birthday && daysUntilBirthday(c.birthday) <= 14 && daysUntilBirthday(c.birthday) >= 0)
          .sort((a, b) => daysUntilBirthday(a.birthday) - daysUntilBirthday(b.birthday));
        if (!upcoming.length) return null;
        return (
          <div className="birthday-banner">
            <span style={{ fontSize: 16 }}>🎂</span>
            <span>
              {upcoming.map((c, i) => {
                const d = daysUntilBirthday(c.birthday);
                return (
                  <span key={c.id}>
                    {i > 0 && " · "}
                    <strong>{c.name}</strong>
                    {d === 0 ? " today!" : d === 1 ? " tomorrow" : ` in ${d} days`}
                  </span>
                );
              })}
            </span>
          </div>
        );
      })()}

      {/* Contact list */}
      <div className="contact-list">
        {sorted.map((c) => (
          <ContactCard
            key={c.id}
            c={c}
            groupById={groupById}
            allGroups={groups}
            onUpdate={(patch) => actions.updateContact(c.id, patch)}
            onDelete={() => actions.deleteContact(c.id)}
            onAddNote={(text) => actions.addNote(c.id, text)}
            onDeleteNote={(nid) => actions.deleteNote(c.id, nid)}
          />
        ))}
        {sorted.length === 0 && (
          <div className="card" style={{ textAlign: "center", color: "var(--text-3)", padding: "40px 16px" }}>
            {search ? "No contacts match your search." : "No contacts yet. Add your first one above."}
          </div>
        )}
      </div>

      {showAddContact && (
        <AddContactModal groups={groups} onClose={() => setShowAddContact(false)}
          onSave={(contact) => { actions.addContact(contact); setShowAddContact(false); }} />
      )}
      {showManageGroups && (
        <ManageGroupsModal groups={groups} onClose={() => setShowManageGroups(false)}
          onSave={(newGroups) => { actions.saveContactGroups(newGroups); setShowManageGroups(false); }} />
      )}
    </div>
  );
}

// ----------- Contact card -----------

function ContactCard({ c, groupById, allGroups, onUpdate, onDelete, onAddNote, onDeleteNote }) {
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [editLastSeen, setEditLastSeen] = useState(false);
  const [lastSeenVal, setLastSeenVal] = useState(c.lastSeen || "");
  const [editGift, setEditGift] = useState(false);
  const [giftVal, setGiftVal] = useState(c.giftIdeas || "");
  const [noteText, setNoteText] = useState("");
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const [showEditModal, setShowEditModal] = useState(false);
  const [showKebab, setShowKebab] = useState(false);
  const pickerRef = useRef(null);
  const kebabRef = useRef(null);

  useEffect(() => { setLastSeenVal(c.lastSeen || ""); }, [c.lastSeen]);
  useEffect(() => { setGiftVal(c.giftIdeas || ""); }, [c.giftIdeas]);

  useEffect(() => {
    if (!showGroupPicker) return;
    const h = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowGroupPicker(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showGroupPicker]);

  useEffect(() => {
    if (!showKebab) return;
    const h = (e) => { if (kebabRef.current && !kebabRef.current.contains(e.target)) setShowKebab(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showKebab]);

  const contactGroups = c.groups || [];
  const bdayDays = daysUntilBirthday(c.birthday);
  const availableGroups = allGroups.filter((g) => !contactGroups.includes(g.id));

  const addGroup = (gid) => { onUpdate({ groups: [...contactGroups, gid] }); setShowGroupPicker(false); };
  const removeGroup = (gid) => onUpdate({ groups: contactGroups.filter((id) => id !== gid) });

  const saveLastSeen = () => {
    setEditLastSeen(false);
    if (lastSeenVal.trim() !== (c.lastSeen || "")) onUpdate({ lastSeen: lastSeenVal.trim() });
  };
  const saveGift = () => {
    setEditGift(false);
    if (giftVal.trim() !== (c.giftIdeas || "")) onUpdate({ giftIdeas: giftVal.trim() });
  };
  const addNote = () => {
    if (!noteText.trim()) return;
    onAddNote(noteText.trim());
    setNoteText("");
  };
  const toggleNote = (nid) => setExpandedNotes((prev) => {
    const next = new Set(prev);
    next.has(nid) ? next.delete(nid) : next.add(nid);
    return next;
  });

  const PREVIEW = 90;

  return (
    <div className="contact-card">
      {/* Main info row */}
      <div className="contact-row">
        <div className="contact-avatar">
          {c.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
        </div>

        <div className="contact-info">
          <div className="contact-name">{c.name}</div>

          {/* Groups inline */}
          <div className="contact-meta">
            <div className="contact-groups-inline" onClick={(e) => e.stopPropagation()}>
              {contactGroups.map((gid) => {
                const grp = groupById[gid];
                if (!grp) return null;
                return (
                  <span key={gid} className="contact-group-tag">
                    {grp.icon && <span style={{ marginRight: 3 }}>{grp.icon}</span>}{grp.name}
                    <button className="group-tag-remove" onClick={() => removeGroup(gid)}>×</button>
                  </span>
                );
              })}
              {availableGroups.length > 0 && (
                <div style={{ position: "relative" }} ref={pickerRef}>
                  <button className="add-group-btn" onClick={(e) => { e.stopPropagation(); setShowGroupPicker((v) => !v); }}>+</button>
                  {showGroupPicker && (
                    <div className="group-picker-dropdown">
                      {availableGroups.map((g) => (
                        <button key={g.id} onClick={(e) => { e.stopPropagation(); addGroup(g.id); }}>
                          {g.icon && <span style={{ marginRight: 5 }}>{g.icon}</span>}{g.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {c.city && <span>{c.city}</span>}
          </div>

          {(c.tags || []).length > 0 && (
            <div className="contact-tags">
              {c.tags.map((t) => <span key={t} className="contact-tag">{t}</span>)}
            </div>
          )}

          {/* Gift ideas */}
          <div className="contact-gift-inline" onClick={(e) => e.stopPropagation()}>
            {editGift ? (
              <input className="input input--xs" value={giftVal}
                onChange={(e) => setGiftVal(e.target.value)}
                onBlur={saveGift}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); saveGift(); } }}
                autoFocus placeholder="Gift ideas…" />
            ) : (
              <button className="inline-edit-trigger"
                onClick={(e) => { e.stopPropagation(); setGiftVal(c.giftIdeas || ""); setEditGift(true); }}>
                {c.giftIdeas
                  ? <><span style={{ opacity: 0.55, marginRight: 3 }}>🎁</span>{c.giftIdeas}</>
                  : <span style={{ color: "var(--text-3)" }}>+ gift ideas</span>}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="contact-stats">
          {c.birthday && (
            <span className={"contact-bday" + (bdayDays <= 7 ? " is-soon" : "")}>
              🎂 {formatBirthday(c.birthday)}
            </span>
          )}
          <span onClick={(e) => e.stopPropagation()}>
            {editLastSeen ? (
              <input className="input input--xs" value={lastSeenVal}
                onChange={(e) => setLastSeenVal(e.target.value)}
                onBlur={saveLastSeen}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); saveLastSeen(); } }}
                autoFocus placeholder="e.g. 2 weeks ago" style={{ width: 130 }} />
            ) : (
              <button className="inline-edit-trigger contact-lastseen"
                onClick={(e) => { e.stopPropagation(); setLastSeenVal(c.lastSeen || ""); setEditLastSeen(true); }}>
                {c.lastSeen ? `Seen ${c.lastSeen}` : <span style={{ color: "var(--text-3)" }}>+ last seen</span>}
              </button>
            )}
          </span>
        </div>

        {/* Kebab */}
        <div style={{ position: "relative", flexShrink: 0 }} ref={kebabRef}>
          <button className="contact-kebab" onClick={(e) => { e.stopPropagation(); setShowKebab((v) => !v); }}>
            <Icon.Kebab />
          </button>
          {showKebab && (
            <div className="kebab-dropdown">
              <button onClick={(e) => { e.stopPropagation(); setShowEditModal(true); setShowKebab(false); }}>Edit contact</button>
              <button style={{ color: "var(--error)" }} onClick={(e) => { e.stopPropagation(); onDelete(); }}>Delete</button>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="contact-notes-inline">
        {(c.notes || []).map((n) => {
          const expanded = expandedNotes.has(n.id);
          const long = n.text.length > PREVIEW;
          return (
            <div key={n.id} className="card-note">
              <div className="card-note-body">
                <span className="card-note-text">
                  {expanded || !long ? n.text : n.text.slice(0, PREVIEW) + "…"}
                </span>
                {long && (
                  <button className="read-more-btn" onClick={() => toggleNote(n.id)}>
                    {expanded ? "show less" : "read more"}
                  </button>
                )}
              </div>
              <div className="card-note-meta">
                <span className="card-note-time">{fmtTimestamp(n.timestamp)}</span>
                <button className="card-note-del" onClick={() => onDeleteNote(n.id)}><Icon.X /></button>
              </div>
            </div>
          );
        })}
        <div className="card-note-add-row">
          <input className="input input--xs" style={{ flex: 1 }} placeholder="Add a note…"
            value={noteText} onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} />
          <button className="btn btn-primary" style={{ padding: "3px 12px", fontSize: 12 }}
            disabled={!noteText.trim()} onClick={addNote}>Add</button>
        </div>
      </div>

      {showEditModal && (
        <EditContactModal contact={c} groups={allGroups}
          onClose={() => setShowEditModal(false)}
          onSave={(patch) => { onUpdate(patch); setShowEditModal(false); }} />
      )}
    </div>
  );
}

// ----------- Edit Contact modal -----------

function EditContactModal({ contact, groups, onClose, onSave }) {
  const [name, setName] = useState(contact.name);
  const [city, setCity] = useState(contact.city || "");
  const [birthday, setBirthday] = useState(contact.birthday || "");
  const [editGroups, setEditGroups] = useState(contact.groups || []);
  const [lastSeen, setLastSeen] = useState(contact.lastSeen || "");
  const [giftIdeas, setGiftIdeas] = useState(contact.giftIdeas || "");

  const toggleGroup = (gid) => setEditGroups((prev) =>
    prev.includes(gid) ? prev.filter((id) => id !== gid) : [...prev, gid]
  );

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit contact</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>City</label>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. New York" />
          </div>
          <div className="field">
            <label>Birthday</label>
            <BirthdayInput value={birthday} onChange={setBirthday} />
          </div>
          <div className="field">
            <label>Last seen</label>
            <input className="input" value={lastSeen} onChange={(e) => setLastSeen(e.target.value)} placeholder="e.g. 2 weeks ago" />
          </div>
        </div>
        {groups.length > 0 && (
          <div className="field">
            <label>Groups</label>
            <div className="group-checkboxes">
              {groups.map((g) => (
                <label key={g.id} className={"group-checkbox-label" + (editGroups.includes(g.id) ? " is-checked" : "")}>
                  <input type="checkbox" checked={editGroups.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                  {g.icon && <span>{g.icon}</span>} {g.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="field">
          <label>Gift ideas</label>
          <input className="input" value={giftIdeas} onChange={(e) => setGiftIdeas(e.target.value)} placeholder="e.g. Books, vinyl" />
        </div>
        <div className="actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave({ name: name.trim() || contact.name, city: city.trim(), birthday, groups: editGroups, lastSeen: lastSeen.trim(), giftIdeas: giftIdeas.trim() })}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ----------- Birthday input -----------

function BirthdayInput({ value, onChange }) {
  const parse = (iso) => {
    if (!iso) return { month: "", day: "", year: "" };
    const d = new Date(iso + "T00:00:00");
    return { month: String(d.getMonth() + 1), day: String(d.getDate()), year: d.getFullYear() === 2000 ? "" : String(d.getFullYear()) };
  };
  const [parts, setParts] = useState(() => parse(value));
  const toISO = ({ month, day, year }) => {
    if (!month || !day) return "";
    const y = year && year.length === 4 ? year : "2000";
    return `${y}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  };
  const update = (patch) => {
    const next = { ...parts, ...patch };
    setParts(next);
    onChange(toISO(next));
  };
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select className="input" style={{ flex: 2 }} value={parts.month} onChange={(e) => update({ month: e.target.value })}>
        <option value="">Month</option>
        {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
      </select>
      <input className="input" style={{ flex: 1 }} type="number" placeholder="Day" min={1} max={31}
        value={parts.day} onChange={(e) => update({ day: e.target.value })} />
      <input className="input" style={{ flex: 1.5 }} type="number" placeholder="Year" min={1900} max={2100}
        value={parts.year} onChange={(e) => update({ year: e.target.value })} />
    </div>
  );
}

// ----------- Add Contact modal -----------

function AddContactModal({ groups, onClose, onSave }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [birthday, setBirthday] = useState("");
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [lastSeen, setLastSeen] = useState("");

  const toggleGroup = (gid) => setSelectedGroups((prev) =>
    prev.includes(gid) ? prev.filter((id) => id !== gid) : [...prev, gid]
  );

  const save = () => {
    if (!name.trim()) return;
    onSave({ id: "c-" + Date.now(), name: name.trim(), city: city.trim(), birthday: birthday || null, groups: selectedGroups, lastSeen: lastSeen.trim() || null, notes: [] });
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New contact</h3>
        <div className="field">
          <label>Name</label>
          <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label>City</label>
            <input className="input" placeholder="e.g. London" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field">
            <label>Birthday</label>
            <BirthdayInput value={birthday} onChange={setBirthday} />
          </div>
        </div>
        {groups.length > 0 && (
          <div className="field">
            <label>Groups</label>
            <div className="group-checkboxes">
              {groups.map((g) => (
                <label key={g.id} className={"group-checkbox-label" + (selectedGroups.includes(g.id) ? " is-checked" : "")}>
                  <input type="checkbox" checked={selectedGroups.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                  {g.icon && <span>{g.icon}</span>} {g.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="field">
          <label>Last seen</label>
          <input className="input" placeholder="e.g. Last week" value={lastSeen} onChange={(e) => setLastSeen(e.target.value)} />
        </div>
        <div className="actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>Add contact</button>
        </div>
      </div>
    </div>
  );
}

// ----------- Manage Groups modal -----------

function ManageGroupsModal({ groups, onClose, onSave }) {
  const [items, setItems] = useState([...groups]);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");

  const add = () => {
    if (!newName.trim()) return;
    setItems((s) => [...s, { id: "grp-" + Date.now(), name: newName.trim(), icon: newIcon || "👥" }]);
    setNewName(""); setNewIcon("");
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Manage groups</h3>
        <div className="tiny" style={{ marginBottom: 14 }}>Add, rename, or remove contact groups.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((g) => (
            <div key={g.id} className="group-row">
              <input className="group-icon-input" value={g.icon || ""} maxLength={4}
                onChange={(e) => setItems((s) => s.map((x) => x.id === g.id ? { ...x, icon: e.target.value } : x))}
                style={{ width: 36, textAlign: "center" }} />
              <input className="input" style={{ flex: 1 }} value={g.name}
                onChange={(e) => setItems((s) => s.map((x) => x.id === g.id ? { ...x, name: e.target.value } : x))} />
              <button className="btn-text" style={{ color: "var(--error)" }}
                onClick={() => setItems((s) => s.filter((x) => x.id !== g.id))}><Icon.X /></button>
            </div>
          ))}
        </div>
        <div className="group-row" style={{ marginTop: 12 }}>
          <input className="group-icon-input" value={newIcon} maxLength={4}
            onChange={(e) => setNewIcon(e.target.value)} placeholder="👥" style={{ width: 36, textAlign: "center" }} />
          <input className="input" style={{ flex: 1 }} placeholder="New group name" value={newName}
            onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <button className="btn btn-primary" onClick={add} disabled={!newName.trim()}>Add</button>
        </div>
        <div className="actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(items)}>Save groups</button>
        </div>
      </div>
    </div>
  );
}
