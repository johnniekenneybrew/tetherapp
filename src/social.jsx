import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TODAY, MONTHS, Icon, Checkbox, AccountDot } from './shared';
import { contactsApi } from './api';

// ============================================================
// Social — Contacts page
// ============================================================

const formatBirthday = (bday) => {
  if (!bday) return "—";
  const d = new Date(bday + "T00:00:00");
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
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

const initials = (name) => (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const QUICK_REL_TYPES = ["Partner", "Spouse", "Parent", "Child", "Sibling", "Friend", "Colleague", "Mentor"];

export function SocialPage({ state, setState, actions }) {
  const [tagFilter, setTagFilter] = useState("all");
  const [showAddContact, setShowAddContact] = useState(false);
  const [showManageTags, setShowManageTags] = useState(false);
  const [search, setSearch] = useState("");
  const [compact, setCompact] = useState(false);
  const [showLinksView, setShowLinksView] = useState(false);

  const groups = state.contactGroups || [];
  const contacts = state.contacts || [];

  const filtered = contacts.filter((c) => {
    const matchTag = tagFilter === "all" || (c.groups || []).includes(tagFilter);
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.city || "").toLowerCase().includes(search.toLowerCase());
    return matchTag && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));

  // Create contact inline (for LinkedContactPicker) — returns real contact with ID
  const createContactInline = async (name) => {
    try {
      const created = await contactsApi.create({ name: name.trim() });
      setState((s) => ({ ...s, contacts: [...s.contacts, { ...created, notes: [] }] }));
      return created;
    } catch (e) {
      console.error("createContactInline error", e);
      return null;
    }
  };

  return (
    <div className="page fade-in">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 className="page-title">Social</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            {contacts.length} contacts · {groups.length} tags
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {/* Links view toggle */}
          <button className={"btn" + (showLinksView ? " btn-primary" : "")} onClick={() => setShowLinksView((v) => !v)}
            title={showLinksView ? "Back to contacts" : "View relationship networks"}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="2.5" cy="7" r="1.5" fill="currentColor"/>
              <circle cx="7" cy="2.5" r="1.5" fill="currentColor"/>
              <circle cx="11.5" cy="7" r="1.5" fill="currentColor"/>
              <circle cx="7" cy="11.5" r="1.5" fill="currentColor"/>
              <line x1="2.5" y1="7" x2="7" y2="2.5" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="7" y1="2.5" x2="11.5" y2="7" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="2.5" y1="7" x2="7" y2="11.5" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="7" y1="11.5" x2="11.5" y2="7" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            Networks
          </button>
          {/* Compact toggle */}
          {!showLinksView && (
            <button className={"btn" + (compact ? " btn-primary" : "")} onClick={() => setCompact((v) => !v)}
              title={compact ? "Switch to list view" : "Switch to grid view"}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                {compact
                  ? <><rect x="1" y="1" width="12" height="3" rx="1" fill="currentColor" opacity=".4"/><rect x="1" y="5.5" width="12" height="3" rx="1" fill="currentColor" opacity=".4"/><rect x="1" y="10" width="12" height="3" rx="1" fill="currentColor"/></>
                  : <><rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="7.5" y="1" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="1" y="7.5" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1" fill="currentColor"/></>
                }
              </svg>
              {compact ? "List" : "Grid"}
            </button>
          )}
          <button className="btn" onClick={() => setShowManageTags(true)}>Manage tags</button>
          <button className="btn btn-primary" onClick={() => setShowAddContact(true)}>
            <Icon.Plus /> Add contact
          </button>
        </div>
      </div>

      {!showLinksView && (
        <>
          {/* Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
            <div className="filter-row">
              <button className={"filter-btn" + (tagFilter === "all" ? " is-active" : "")} onClick={() => setTagFilter("all")}>All</button>
              {groups.map((g) => (
                <button key={g.id} className={"filter-btn" + (tagFilter === g.id ? " is-active" : "")} onClick={() => setTagFilter(g.id)}>
                  {g.icon ? <span style={{ marginRight: 4 }}>{g.icon}</span> : null}{g.name}
                </button>
              ))}
            </div>
            <div className="spacer" />
            <input className="input" style={{ maxWidth: 220, padding: "7px 12px", fontSize: 13 }}
              placeholder="Search contacts…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

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
          <div className={compact ? "contact-list contact-list--grid" : "contact-list"}>
            {sorted.map((c) => (
              <ContactCard
                key={c.id}
                c={c}
                compact={compact}
                groupById={groupById}
                allGroups={groups}
                allContacts={contacts}
                onUpdate={(patch) => actions.updateContact(c.id, patch)}
                onDelete={() => actions.deleteContact(c.id)}
                onAddNote={(text) => actions.addNote(c.id, text)}
                onDeleteNote={(nid) => actions.deleteNote(c.id, nid)}
                onCreateContact={createContactInline}
              />
            ))}
            {sorted.length === 0 && (
              <div className="card" style={{ textAlign: "center", color: "var(--text-3)", padding: "40px 16px", gridColumn: "1/-1" }}>
                {search ? "No contacts match your search." : "No contacts yet. Add your first one above."}
              </div>
            )}
          </div>
        </>
      )}

      {showLinksView && (
        <RelationshipLinksView contacts={contacts} />
      )}

      {showAddContact && (
        <AddContactModal groups={groups} onClose={() => setShowAddContact(false)}
          onSave={(contact) => { actions.addContact(contact); setShowAddContact(false); }} />
      )}
      {showManageTags && (
        <ManageTagsModal groups={groups} onClose={() => setShowManageTags(false)}
          onSave={(newGroups) => { actions.saveContactGroups(newGroups); setShowManageTags(false); }} />
      )}
    </div>
  );
}

// ----------- Relationship links view -----------

function RelationshipLinksView({ contacts }) {
  const contactById = Object.fromEntries(contacts.map((c) => [c.id, c]));

  // Build undirected adjacency from linkedContacts on each contact
  const adj = {};
  contacts.forEach((c) => {
    if (!adj[c.id]) adj[c.id] = [];
    (c.linkedContacts || []).forEach((link) => {
      adj[c.id].push({ id: link.id, rel: link.relationship });
      if (!adj[link.id]) adj[link.id] = [];
      if (!adj[link.id].some((x) => x.id === c.id)) {
        adj[link.id].push({ id: c.id, rel: link.relationship });
      }
    });
  });

  // Find connected components (BFS)
  const visited = new Set();
  const networks = [];
  contacts.forEach((c) => {
    if (visited.has(c.id)) return;
    if (!adj[c.id] || adj[c.id].length === 0) return;
    const component = [];
    const queue = [c.id];
    visited.add(c.id);
    while (queue.length > 0) {
      const id = queue.shift();
      component.push(id);
      (adj[id] || []).forEach((link) => {
        if (!visited.has(link.id)) {
          visited.add(link.id);
          queue.push(link.id);
        }
      });
    }
    networks.push(component);
  });

  if (networks.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-3)" }}>
        No linked contacts yet. Open any contact card and use "+ Link" to connect people together.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {networks.map((ids, i) => (
        <div key={i} className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span className="contact-section-label" style={{ marginBottom: 0 }}>
              Network · {ids.length} people
            </span>
          </div>
          <div className="network-grid">
            {ids.map((id) => {
              const c = contactById[id];
              if (!c) return null;
              const links = (adj[id] || []).filter((l) => contactById[l.id]);
              return (
                <div key={id} className="network-member">
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                    <div className="contact-avatar" style={{ width: 28, height: 28, fontSize: 9 }}>
                      {initials(c.name)}
                    </div>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</span>
                  </div>
                  {links.map((link, j) => {
                    const lc = contactById[link.id];
                    return (
                      <div key={j} className="network-link-line">
                        <span className="network-rel">{link.rel || "linked to"}</span>
                        <span className="network-target">{lc?.name}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ----------- Contact card -----------

function ContactCard({ c, compact, groupById, allGroups, allContacts, onUpdate, onDelete, onAddNote, onDeleteNote, onCreateContact }) {
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [editLastSeen, setEditLastSeen] = useState(false);
  const [lastSeenVal, setLastSeenVal] = useState(c.lastSeen || "");
  const [editGift, setEditGift] = useState(false);
  const [giftVal, setGiftVal] = useState(c.giftIdeas || "");
  const [editContext, setEditContext] = useState(false);
  const [contextVal, setContextVal] = useState(c.context || "");
  const [noteText, setNoteText] = useState("");
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const [showEditModal, setShowEditModal] = useState(false);
  const [showKebab, setShowKebab] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const pickerRef = useRef(null);
  const kebabRef = useRef(null);
  const linkPickerRef = useRef(null);

  useEffect(() => { setLastSeenVal(c.lastSeen || ""); }, [c.lastSeen]);
  useEffect(() => { setGiftVal(c.giftIdeas || ""); }, [c.giftIdeas]);
  useEffect(() => { setContextVal(c.context || ""); }, [c.context]);

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

  useEffect(() => {
    if (!showLinkPicker) return;
    const h = (e) => { if (linkPickerRef.current && !linkPickerRef.current.contains(e.target)) setShowLinkPicker(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showLinkPicker]);

  const contactGroups = c.groups || [];
  const bdayDays = daysUntilBirthday(c.birthday);
  const availableGroups = allGroups.filter((g) => !contactGroups.includes(g.id));
  const allContactsById = Object.fromEntries(allContacts.map((ct) => [ct.id, ct]));
  const linkedContacts = c.linkedContacts || [];

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
  const saveContext = () => {
    setEditContext(false);
    if (contextVal !== (c.context || "")) onUpdate({ context: contextVal });
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

  const addLinkedContact = (id, relationship) => {
    const next = [...linkedContacts, { id, relationship }];
    onUpdate({ linkedContacts: next });
    setShowLinkPicker(false);
  };
  const removeLinkedContact = (id) => {
    onUpdate({ linkedContacts: linkedContacts.filter((l) => l.id !== id) });
  };

  const PREVIEW = 90;
  const inits = initials(c.name);

  // Compact card (grid view)
  if (compact) {
    return (
      <div className="contact-card contact-card--compact">
        <div style={{ padding: "12px 14px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
            <div className="contact-avatar" style={{ width: 28, height: 28, fontSize: 9, flexShrink: 0 }}>{inits}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 13.5, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
              {contactGroups.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                  {contactGroups.slice(0, 3).map((gid) => {
                    const grp = groupById[gid];
                    return grp ? (
                      <span key={gid} className="contact-group-tag" style={{ fontSize: 10, padding: "1px 5px" }}>
                        {grp.icon && <span style={{ marginRight: 2 }}>{grp.icon}</span>}{grp.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
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

          {/* Location */}
          {(c.from || c.city) && (
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 4 }}>
              {c.from && <span><span style={{ color: "var(--text-3)" }}>From</span> {c.from}</span>}
              {c.from && c.city && <span style={{ color: "var(--text-3)" }}> · </span>}
              {c.city && <span><span style={{ color: "var(--text-3)" }}>Now</span> {c.city}</span>}
            </div>
          )}

          {/* Last seen */}
          {c.lastSeen && (
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 4 }}>
              <span style={{ color: "var(--text-3)" }}>Last seen</span> {c.lastSeen}
            </div>
          )}

          {/* Context snippet */}
          {c.context && (
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 5,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.context}
            </div>
          )}

          {/* Linked contacts mini */}
          {linkedContacts.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {linkedContacts.slice(0, 3).map((link) => {
                const ct = allContactsById[link.id];
                return ct ? (
                  <span key={link.id} className="linked-contact-pill" style={{ fontSize: 10.5 }}>
                    <span className="linked-avatar" style={{ width: 14, height: 14, fontSize: 6 }}>{initials(ct.name)}</span>
                    <span className="linked-name">{ct.name}</span>
                    {link.relationship && <span className="linked-rel">— {link.relationship}</span>}
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>

        {showEditModal && (
          <EditContactModal contact={c} groups={allGroups}
            onClose={() => setShowEditModal(false)}
            onSave={(patch) => { onUpdate(patch); setShowEditModal(false); }} />
        )}
      </div>
    );
  }

  // Full card
  return (
    <div className="contact-card">
      {/* Main info row */}
      <div className="contact-row">
        <div className="contact-avatar">{inits}</div>

        <div className="contact-info">
          <div className="contact-name">{c.name}</div>

          {/* Tags inline */}
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
          </div>

          {/* From + Current Location */}
          <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            {c.from && (
              <span className="tiny" style={{ color: "var(--text-2)" }}>
                <span style={{ color: "var(--text-3)" }}>From</span> {c.from}
              </span>
            )}
            {c.city && (
              <span className="tiny" style={{ color: "var(--text-2)" }}>
                <span style={{ color: "var(--text-3)" }}>Now</span> {c.city}
              </span>
            )}
            {c.introducedBy && (
              <span className="tiny" style={{ color: "var(--text-2)" }}>
                <span style={{ color: "var(--text-3)" }}>Via</span> {c.introducedBy}
              </span>
            )}
          </div>

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
                {c.lastSeen
                  ? <><span style={{ color: "var(--text-3)" }}>Last seen</span> {c.lastSeen}</>
                  : <span style={{ color: "var(--text-3)" }}>+ last seen</span>}
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

      {/* Context section */}
      <div className="contact-section">
        <div className="contact-section-label">Context</div>
        {editContext ? (
          <textarea className="input" rows={3} style={{ fontSize: 13, marginTop: 4 }}
            value={contextVal}
            onChange={(e) => setContextVal(e.target.value)}
            onBlur={saveContext}
            onKeyDown={(e) => { if (e.key === "Escape") saveContext(); }}
            autoFocus placeholder="Relationship context — how you know them, what matters…" />
        ) : (
          <button className="inline-edit-trigger" style={{ display: "block", textAlign: "left", padding: "4px 6px", width: "100%", marginTop: 2 }}
            onClick={() => { setContextVal(c.context || ""); setEditContext(true); }}>
            {c.context
              ? <span style={{ color: "var(--text)", fontSize: 13, lineHeight: 1.5 }}>{c.context}</span>
              : <span style={{ color: "var(--text-3)", fontSize: 13 }}>+ add context…</span>}
          </button>
        )}
      </div>

      {/* Linked contacts */}
      <div className="contact-section" style={{ paddingTop: 8 }}>
        <div className="contact-section-label">Linked contacts</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
          {linkedContacts.map((link) => {
            const ct = allContactsById[link.id];
            return ct ? (
              <span key={link.id} className="linked-contact-pill">
                <span className="linked-avatar">{initials(ct.name)}</span>
                <span className="linked-name">{ct.name}</span>
                {link.relationship && <span className="linked-rel">— {link.relationship}</span>}
                <button className="group-tag-remove" onClick={() => removeLinkedContact(link.id)}>×</button>
              </span>
            ) : null;
          })}
          <div style={{ position: "relative" }} ref={linkPickerRef}>
            <button className="add-group-btn" style={{ width: "auto", padding: "2px 8px", fontSize: 12, borderRadius: 6 }}
              onClick={(e) => { e.stopPropagation(); setShowLinkPicker((v) => !v); }}>
              + Link
            </button>
            {showLinkPicker && (
              <LinkedContactPicker
                allContacts={allContacts}
                excludeIds={[c.id, ...linkedContacts.map((l) => l.id)]}
                onSelect={addLinkedContact}
                onClose={() => setShowLinkPicker(false)}
                onCreateContact={onCreateContact}
              />
            )}
          </div>
        </div>
      </div>

      {/* Notes — recent updates */}
      <div className="contact-notes-inline" style={{ paddingTop: 10 }}>
        <div className="contact-section-label" style={{ marginBottom: 6 }}>Recent updates</div>
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
          <input className="input input--xs" style={{ flex: 1 }} placeholder="Add a recent update…"
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

// ----------- Linked contact picker -----------

function LinkedContactPicker({ allContacts, excludeIds, onSelect, onClose, onCreateContact }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [relationship, setRelationship] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = allContacts.filter((c) =>
    !excludeIds.includes(c.id) &&
    (!search || c.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (showCreateForm) {
    return (
      <div className="link-picker-dropdown">
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>Create new contact</div>
        <input className="input input--xs" style={{ width: "100%", marginBottom: 8 }}
          placeholder="Full name"
          value={newName} onChange={(e) => setNewName(e.target.value)}
          autoFocus
          onKeyDown={async (e) => {
            if (e.key === "Enter" && newName.trim() && onCreateContact) {
              setCreating(true);
              const created = await onCreateContact(newName.trim());
              if (created) setSelected(created);
              setCreating(false);
              setShowCreateForm(false);
            }
            if (e.key === "Escape") setShowCreateForm(false);
          }} />
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-primary" style={{ fontSize: 12, padding: "3px 10px" }}
            disabled={!newName.trim() || creating}
            onClick={async () => {
              if (!onCreateContact) return;
              setCreating(true);
              const created = await onCreateContact(newName.trim());
              if (created) setSelected(created);
              setCreating(false);
              setShowCreateForm(false);
            }}>
            {creating ? "Creating…" : "Create"}
          </button>
          <button className="btn-text" style={{ fontSize: 12 }} onClick={() => { setShowCreateForm(false); setNewName(""); }}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="link-picker-dropdown">
      {!selected ? (
        <>
          <input className="input input--xs" style={{ width: "100%", marginBottom: 6 }}
            placeholder="Search contacts…" value={search}
            onChange={(e) => setSearch(e.target.value)} autoFocus />
          <div style={{ maxHeight: 160, overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div className="tiny" style={{ padding: "6px 4px", color: "var(--text-3)" }}>No contacts found</div>
            )}
            {filtered.map((c) => (
              <button key={c.id} onClick={() => setSelected(c)}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 8px", borderRadius: 6, background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13 }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, flexShrink: 0 }}>
                  {initials(c.name)}
                </span>
                {c.name}
              </button>
            ))}
          </div>
          {onCreateContact && (
            <div style={{ borderTop: "1px solid var(--border-soft)", marginTop: 4, paddingTop: 6 }}>
              <button onClick={() => { setShowCreateForm(true); setNewName(search); }}
                style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "5px 8px", borderRadius: 6, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--accent)" }}>
                <Icon.Plus /> New contact{search ? ` "${search}"` : ""}
              </button>
            </div>
          )}
        </>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 10 }}>
            Linking <strong>{selected.name}</strong> — choose relationship:
          </div>
          {/* Quick type pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {QUICK_REL_TYPES.map((t) => (
              <button key={t}
                onClick={() => { setRelationship(t); onSelect(selected.id, t); }}
                style={{
                  padding: "3px 9px", border: "1px solid var(--border)", borderRadius: 999,
                  fontSize: 11.5, cursor: "pointer", background: "none", color: "var(--text-2)",
                  transition: "all 120ms",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--text)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "var(--text)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-2)"; e.currentTarget.style.borderColor = "var(--border)"; }}>
                {t}
              </button>
            ))}
          </div>
          <input className="input input--xs" style={{ width: "100%", marginBottom: 8 }}
            placeholder="Or type custom (e.g. Mom, Business partner)"
            value={relationship} onChange={(e) => setRelationship(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect(selected.id, relationship.trim());
              if (e.key === "Escape") setSelected(null);
            }} />
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-primary" style={{ fontSize: 12, padding: "3px 10px" }}
              onClick={() => onSelect(selected.id, relationship.trim())}>Link</button>
            <button className="btn-text" style={{ fontSize: 12 }} onClick={() => setSelected(null)}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------- Edit Contact modal -----------

function EditContactModal({ contact, groups, onClose, onSave }) {
  const [name, setName]               = useState(contact.name);
  const [from, setFrom]               = useState(contact.from || "");
  const [city, setCity]               = useState(contact.city || "");
  const [birthday, setBirthday]       = useState(contact.birthday || "");
  const [editGroups, setEditGroups]   = useState(contact.groups || []);
  const [lastSeen, setLastSeen]       = useState(contact.lastSeen || "");
  const [giftIdeas, setGiftIdeas]     = useState(contact.giftIdeas || "");
  const [introducedBy, setIntroducedBy] = useState(contact.introducedBy || "");

  const toggleGroup = (gid) => setEditGroups((prev) =>
    prev.includes(gid) ? prev.filter((id) => id !== gid) : [...prev, gid]
  );

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit contact</h3>
        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label>From</label>
            <input className="input" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="e.g. Boston, Colombia" />
          </div>
          <div className="field">
            <label>Current location</label>
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
        <div className="field">
          <label>Introduced by</label>
          <input className="input" value={introducedBy} onChange={(e) => setIntroducedBy(e.target.value)} placeholder="e.g. Sarah M." />
        </div>
        {groups.length > 0 && (
          <div className="field">
            <label>Tags</label>
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
          <button className="btn btn-primary" onClick={() => onSave({
            name: name.trim() || contact.name,
            from: from.trim(), city: city.trim(),
            birthday, groups: editGroups,
            lastSeen: lastSeen.trim(), giftIdeas: giftIdeas.trim(),
            introducedBy: introducedBy.trim(),
          })}>Save</button>
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
  const [name, setName]               = useState("");
  const [from, setFrom]               = useState("");
  const [city, setCity]               = useState("");
  const [birthday, setBirthday]       = useState("");
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [lastSeen, setLastSeen]       = useState("");
  const [introducedBy, setIntroducedBy] = useState("");

  const toggleGroup = (gid) => setSelectedGroups((prev) =>
    prev.includes(gid) ? prev.filter((id) => id !== gid) : [...prev, gid]
  );

  const save = () => {
    if (!name.trim()) return;
    onSave({ id: "c-" + Date.now(), name: name.trim(), from: from.trim(), city: city.trim(), birthday: birthday || null, groups: selectedGroups, lastSeen: lastSeen.trim() || null, introducedBy: introducedBy.trim(), notes: [] });
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
            <label>From</label>
            <input className="input" placeholder="e.g. Boston" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>Current location</label>
            <input className="input" placeholder="e.g. London" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field">
            <label>Birthday</label>
            <BirthdayInput value={birthday} onChange={setBirthday} />
          </div>
          <div className="field">
            <label>Last seen</label>
            <input className="input" placeholder="e.g. Last week" value={lastSeen} onChange={(e) => setLastSeen(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Introduced by</label>
          <input className="input" placeholder="e.g. Sarah M." value={introducedBy} onChange={(e) => setIntroducedBy(e.target.value)} />
        </div>
        {groups.length > 0 && (
          <div className="field">
            <label>Tags</label>
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
        <div className="actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>Add contact</button>
        </div>
      </div>
    </div>
  );
}

// ----------- Manage Tags modal -----------

function ManageTagsModal({ groups, onClose, onSave }) {
  const [items, setItems] = useState([...groups]);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");

  const add = () => {
    if (!newName.trim()) return;
    setItems((s) => [...s, { id: "grp-" + Date.now(), name: newName.trim(), icon: newIcon || "🏷️" }]);
    setNewName(""); setNewIcon("");
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Manage tags</h3>
        <div className="tiny" style={{ marginBottom: 14 }}>Add, rename, or remove contact tags.</div>
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
            onChange={(e) => setNewIcon(e.target.value)} placeholder="🏷️" style={{ width: 36, textAlign: "center" }} />
          <input className="input" style={{ flex: 1 }} placeholder="New tag name" value={newName}
            onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <button className="btn btn-primary" onClick={add} disabled={!newName.trim()}>Add</button>
        </div>
        <div className="actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(items)}>Save tags</button>
        </div>
      </div>
    </div>
  );
}
