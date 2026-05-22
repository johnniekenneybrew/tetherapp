import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TODAY, MONTHS, Icon, Checkbox, AccountDot } from './shared';

// ============================================================
// Social — Contacts page
// ============================================================

// Birthday helpers
const formatBirthday = (bday) => {
  if (!bday) return "—";
  const d = new Date(bday + "T00:00:00");
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
};

const fmtBday = (bday) => {
  if (!bday) return "—";
  const d = new Date(bday + "T00:00:00");
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const daysUntilBirthday = (bday) => {
  if (!bday) return Infinity;
  const d = new Date(bday + "T00:00:00");
  const next = new Date(TODAY.getFullYear(), d.getMonth(), d.getDate());
  if (next < TODAY) next.setFullYear(next.getFullYear() + 1);
  return Math.round((next - TODAY) / (1000 * 60 * 60 * 24));
};

export function SocialPage({ state, setState }) {
  const [groupFilter, setGroupFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
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
    const matchGroup = groupFilter === "all" || c.group === groupFilter;
    const matchTag = !tagFilter || (c.tags || []).includes(tagFilter);
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.city || "").toLowerCase().includes(search.toLowerCase());
    return matchGroup && matchTag && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));

  const updateContact = (id, patch) => {
    setState((s) => ({
      ...s,
      contacts: s.contacts.map((c) => c.id === id ? { ...c, ...patch } : c),
    }));
  };

  const deleteContact = (id) => {
    setState((s) => ({ ...s, contacts: s.contacts.filter((c) => c.id !== id) }));
    setExpandedId(null);
  };

  const addNote = (contactId, text) => {
    if (!text.trim()) return;
    const note = {
      id: "n-" + Date.now(),
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      contacts: s.contacts.map((c) =>
        c.id === contactId ? { ...c, notes: [note, ...(c.notes || [])] } : c
      ),
    }));
  };

  const deleteNote = (contactId, noteId) => {
    setState((s) => ({
      ...s,
      contacts: s.contacts.map((c) =>
        c.id === contactId
          ? { ...c, notes: (c.notes || []).filter((n) => n.id !== noteId) }
          : c
      ),
    }));
  };

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
          <button className="btn" onClick={() => setShowManageGroups(true)}>
            Manage groups
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddContact(true)}>
            <Icon.Plus /> Add contact
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div className="filter-row">
          <button
            className={"filter-btn" + (groupFilter === "all" ? " is-active" : "")}
            onClick={() => setGroupFilter("all")}>
            All
          </button>
          {groups.map((g) => (
            <button key={g.id}
              className={"filter-btn" + (groupFilter === g.id ? " is-active" : "")}
              onClick={() => setGroupFilter(g.id)}>
              {g.icon ? <span style={{ marginRight: 4 }}>{g.icon}</span> : null}
              {g.name}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <input
          className="input"
          style={{ maxWidth: 220, padding: "7px 12px", fontSize: 13 }}
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          <span className="tiny" style={{ marginRight: 4 }}>Tags</span>
          {allTags.map((tag) => (
            <button key={tag}
              className={"tag-filter" + (tagFilter === tag ? " is-active" : "")}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}>
              {tag}
            </button>
          ))}
          {tagFilter && (
            <button className="btn-text" style={{ fontSize: 12 }} onClick={() => setTagFilter(null)}>
              Clear
            </button>
          )}
        </div>
      )}

      {/* Upcoming birthdays banner */}
      {(() => {
        const upcoming = contacts
          .filter((c) => c.birthday && daysUntilBirthday(c.birthday) <= 14 && daysUntilBirthday(c.birthday) >= 0)
          .sort((a, b) => daysUntilBirthday(a.birthday) - daysUntilBirthday(b.birthday));
        if (upcoming.length === 0) return null;
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
        {sorted.map((c) => {
          const isOpen = expandedId === c.id;
          const group = groupById[c.group];
          const bdayDays = daysUntilBirthday(c.birthday);
          return (
            <div key={c.id} className={"contact-card" + (isOpen ? " is-open" : "")}>
              <div className="contact-row" onClick={() => setExpandedId(isOpen ? null : c.id)}>
                <div className="contact-avatar">
                  {c.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                </div>
                <div className="contact-info">
                  <div className="contact-name">{c.name}</div>
                  <div className="contact-meta">
                    {group && <span className="contact-group-tag">{group.icon || ""} {group.name}</span>}
                    {c.city && <span>{c.city}</span>}
                  </div>
                  {(c.tags || []).length > 0 && (
                    <div className="contact-tags">
                      {c.tags.map((t) => <span key={t} className="contact-tag">{t}</span>)}
                    </div>
                  )}
                </div>
                {c.notes && c.notes.length > 0 && (
                  <div className="contact-note-bubble">
                    <span className="cnb-text">
                      {c.notes[0].text.length > 55 ? c.notes[0].text.slice(0, 55) + "…" : c.notes[0].text}
                    </span>
                  </div>
                )}
                <div className="contact-stats">
                  {c.birthday && (
                    <span className={"contact-bday" + (bdayDays <= 7 ? " is-soon" : "")}>
                      🎂 {formatBirthday(c.birthday)}
                    </span>
                  )}
                  {c.lastSeen && (
                    <span className="contact-lastseen">
                      Last seen {c.lastSeen}
                    </span>
                  )}
                </div>
                <Icon.Chevron style={{
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 150ms",
                  color: "var(--text-3)",
                  flexShrink: 0,
                }} />
              </div>

              {isOpen && (
                <ContactDetail
                  contact={c}
                  group={group}
                  groups={groups}
                  onUpdate={(patch) => updateContact(c.id, patch)}
                  onDelete={() => deleteContact(c.id)}
                  onAddNote={(text) => addNote(c.id, text)}
                  onDeleteNote={(nid) => deleteNote(c.id, nid)}
                />
              )}
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="card" style={{ textAlign: "center", color: "var(--text-3)", padding: "40px 16px" }}>
            {search ? "No contacts match your search." : "No contacts yet. Add your first one above."}
          </div>
        )}
      </div>

      {showAddContact && (
        <AddContactModal
          groups={groups}
          onClose={() => setShowAddContact(false)}
          onSave={(contact) => {
            setState((s) => ({ ...s, contacts: [...s.contacts, contact] }));
            setShowAddContact(false);
          }}
        />
      )}

      {showManageGroups && (
        <ManageGroupsModal
          groups={groups}
          onClose={() => setShowManageGroups(false)}
          onSave={(newGroups) => {
            setState((s) => ({ ...s, contactGroups: newGroups }));
            setShowManageGroups(false);
          }}
        />
      )}
    </div>
  );
}

// ----------- Contact detail (expanded) -----------

function ContactDetail({ contact, group, groups, onUpdate, onDelete, onAddNote, onDeleteNote }) {
  const [noteText, setNoteText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(contact.name);
  const [editCity, setEditCity] = useState(contact.city || "");
  const [editBirthday, setEditBirthday] = useState(contact.birthday || "");
  const [editGroup, setEditGroup] = useState(contact.group || "");
  const [editLastSeen, setEditLastSeen] = useState(contact.lastSeen || "");
  const [editGiftIdeas, setEditGiftIdeas] = useState(contact.giftIdeas || "");

  const saveEdit = () => {
    onUpdate({
      name: editName.trim() || contact.name,
      city: editCity.trim(),
      birthday: editBirthday,
      group: editGroup,
      lastSeen: editLastSeen.trim(),
      giftIdeas: editGiftIdeas.trim(),
    });
    setEditing(false);
  };

  const fmtTimestamp = (iso) => {
    const d = new Date(iso);
    const mo = MONTHS[d.getMonth()].slice(0, 3);
    const day = d.getDate();
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    return `${mo} ${day} · ${h % 12 || 12}:${m} ${ampm}`;
  };

  return (
    <div className="contact-detail fade-in">
      {!editing ? (
        <div className="cd-fields">
          <div className="cd-field">
            <span className="cd-label">City</span>
            <span className="cd-value">{contact.city || "—"}</span>
          </div>
          <div className="cd-field">
            <span className="cd-label">Birthday</span>
            <span className="cd-value">{contact.birthday ? fmtBday(contact.birthday) : "—"}</span>
          </div>
          <div className="cd-field">
            <span className="cd-label">Group</span>
            <span className="cd-value">{group ? `${group.icon || ""} ${group.name}` : "—"}</span>
          </div>
          <div className="cd-field">
            <span className="cd-label">Last seen</span>
            <span className="cd-value">{contact.lastSeen || "—"}</span>
          </div>
          <div className="cd-field" style={{ gridColumn: "1 / -1" }}>
            <span className="cd-label">Gift ideas</span>
            <span className="cd-value">{contact.giftIdeas || "—"}</span>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <button className="btn-text" onClick={() => setEditing(true)}>Edit details</button>
            <button className="btn-text" style={{ color: "var(--error)" }} onClick={onDelete}>Delete contact</button>
          </div>
        </div>
      ) : (
        <div className="cd-edit fade-in">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field">
              <label>Name</label>
              <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="field">
              <label>City</label>
              <input className="input" value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="e.g. New York" />
            </div>
            <div className="field">
              <label>Birthday</label>
              <input className="input" type="date" value={editBirthday} onChange={(e) => setEditBirthday(e.target.value)} />
            </div>
            <div className="field">
              <label>Last seen</label>
              <input className="input" value={editLastSeen} onChange={(e) => setEditLastSeen(e.target.value)} placeholder="e.g. 2 weeks ago" />
            </div>
          </div>
          <div className="field">
            <label>Group</label>
            <select className="input" value={editGroup} onChange={(e) => setEditGroup(e.target.value)}>
              <option value="">No group</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Gift ideas</label>
            <input className="input" value={editGiftIdeas} onChange={(e) => setEditGiftIdeas(e.target.value)} placeholder="e.g. Books, vinyl, concert tickets" />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary" onClick={saveEdit}>Save</button>
            <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="cd-notes">
        <div className="cd-notes-head">
          <span style={{ fontSize: 13, fontWeight: 600 }}>Notes</span>
          <span className="tiny">{(contact.notes || []).length}</span>
        </div>
        <div className="cd-note-add">
          <input
            className="input"
            placeholder="Add a note…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && noteText.trim()) {
                onAddNote(noteText);
                setNoteText("");
              }
            }}
          />
          <button className="btn btn-primary" disabled={!noteText.trim()}
            onClick={() => { onAddNote(noteText); setNoteText(""); }}>
            Add
          </button>
        </div>
        <div className="cd-note-list">
          {(contact.notes || []).map((n) => (
            <div key={n.id} className="cd-note">
              <div className="cd-note-text">{n.text}</div>
              <div className="cd-note-footer">
                <span className="cd-note-time">{fmtTimestamp(n.timestamp)}</span>
                <button className="cd-note-del" onClick={() => onDeleteNote(n.id)}>
                  <Icon.X />
                </button>
              </div>
            </div>
          ))}
          {(contact.notes || []).length === 0 && (
            <div className="tiny" style={{ padding: "8px 0" }}>No notes yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------- Add Contact modal -----------

function AddContactModal({ groups, onClose, onSave }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [birthday, setBirthday] = useState("");
  const [group, setGroup] = useState(groups[0]?.id || "");
  const [lastSeen, setLastSeen] = useState("");

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: "c-" + Date.now(),
      name: name.trim(),
      city: city.trim(),
      birthday: birthday || null,
      group,
      lastSeen: lastSeen.trim() || null,
      notes: [],
    });
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New contact</h3>
        <div className="field">
          <label>Name</label>
          <input className="input" placeholder="Full name" value={name}
            onChange={(e) => setName(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label>City</label>
            <input className="input" placeholder="e.g. London" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field">
            <label>Birthday</label>
            <input className="input" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Group</label>
          <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">No group</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Last seen</label>
          <input className="input" placeholder="e.g. Last week, March 2026" value={lastSeen} onChange={(e) => setLastSeen(e.target.value)} />
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
  const remove = (id) => setItems((s) => s.filter((g) => g.id !== id));
  const rename = (id, name) => setItems((s) => s.map((g) => g.id === id ? { ...g, name } : g));
  const changeIcon = (id, icon) => setItems((s) => s.map((g) => g.id === id ? { ...g, icon } : g));

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Manage groups</h3>
        <div className="tiny" style={{ marginBottom: 14 }}>Add, rename, or remove contact groups.</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((g) => (
            <div key={g.id} className="group-row">
              <input className="group-icon-input" value={g.icon || ""} maxLength={4}
                onChange={(e) => changeIcon(g.id, e.target.value)}
                style={{ width: 36, textAlign: "center" }} />
              <input className="input" style={{ flex: 1 }} value={g.name}
                onChange={(e) => rename(g.id, e.target.value)} />
              <button className="btn-text" style={{ color: "var(--error)" }} onClick={() => remove(g.id)}>
                <Icon.X />
              </button>
            </div>
          ))}
        </div>

        <div className="group-row" style={{ marginTop: 12 }}>
          <input className="group-icon-input" value={newIcon} maxLength={4}
            onChange={(e) => setNewIcon(e.target.value)}
            placeholder="👥" style={{ width: 36, textAlign: "center" }} />
          <input className="input" style={{ flex: 1 }}
            placeholder="New group name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
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
