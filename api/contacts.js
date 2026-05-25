import {
  listContacts, getContact, createContact, updateContact, deleteContact,
  listContactGroups, addContactToGroup, removeContactFromGroup,
  getCustomField, setCustomField, isConnected
} from "./_google-people.js";
import { setCors } from "./_notion.js";

function toContact(googlePerson) {
  const names = googlePerson.names || [];
  const emails = googlePerson.emailAddresses || [];
  const phones = googlePerson.phoneNumbers || [];
  const addresses = googlePerson.addresses || [];
  const birthdays = googlePerson.birthdays || [];
  const relations = googlePerson.relations || [];
  const memberships = googlePerson.memberships || [];
  const userDefined = googlePerson.userDefined || [];

  return {
    _googleId: googlePerson.resourceName,
    id: googlePerson.resourceName,
    name: names[0]?.displayName || "",
    email: emails[0]?.value || "",
    phone: phones[0]?.value || "",
    city: addresses[0]?.city || "",
    birthday: birthdays[0]?.date?.month && birthdays[0]?.date?.day
      ? `${birthdays[0].date.year || "0000"}-${String(birthdays[0].date.month).padStart(2, "0")}-${String(birthdays[0].date.day).padStart(2, "0")}`
      : null,
    groups: memberships
      .map(m => m.contactGroupMembership?.contactGroupResourceName || "")
      .filter(r => /^contactGroups\/\d+$/.test(r)), // only user groups (numeric IDs)
    linkedContacts: (() => {
      const json = getCustomField(userDefined, "linkedContacts");
      if (!json) return [];
      try { return JSON.parse(json); } catch { return []; }
    })(),
    from: getCustomField(userDefined, "from") || "",
    lastSeen: getCustomField(userDefined, "lastSeen") || "",
    giftIdeas: getCustomField(userDefined, "giftIdeas") || "",
    context: getCustomField(userDefined, "context") || "",
    introducedBy: getCustomField(userDefined, "introducedBy") || "",
    tags: [],
    notes: [],
  };
}

function toGooglePerson(contact, existingPerson = null) {
  // Shallow clone so we don't mutate the original
  const person = existingPerson ? { ...existingPerson } : {};

  // Only update each field if it is explicitly present in the patch —
  // this prevents partial patches (e.g. {groups:[…]}) from clearing other fields.
  if (contact.name !== undefined) {
    person.names = [{
      displayName: contact.name || "",
      givenName: contact.name?.split(" ")[0] || "",
      familyName: contact.name?.split(" ").slice(1).join(" ") || "",
    }];
  }
  if (contact.email !== undefined) {
    person.emailAddresses = contact.email ? [{ value: contact.email, type: "work" }] : [];
  }
  if (contact.phone !== undefined) {
    person.phoneNumbers = contact.phone ? [{ value: contact.phone, type: "mobile" }] : [];
  }
  if (contact.city !== undefined) {
    person.addresses = contact.city ? [{ city: contact.city, type: "work" }] : [];
  }
  if (contact.birthday !== undefined) {
    if (contact.birthday) {
      const parts = contact.birthday.split("-").map(Number);
      if (parts.length === 3) {
        person.birthdays = [{ date: { year: parts[0] || undefined, month: parts[1], day: parts[2] } }];
      }
    } else {
      person.birthdays = [];
    }
  }

  // Preserve existing userDefined, then apply only the fields present in the patch
  person.userDefined = existingPerson?.userDefined ? [...existingPerson.userDefined] : [];
  if (contact.from !== undefined)         person.userDefined = setCustomField(person.userDefined, "from",           contact.from || null);
  if (contact.lastSeen !== undefined)     person.userDefined = setCustomField(person.userDefined, "lastSeen",       contact.lastSeen || null);
  if (contact.giftIdeas !== undefined)    person.userDefined = setCustomField(person.userDefined, "giftIdeas",      contact.giftIdeas || null);
  if (contact.context !== undefined)      person.userDefined = setCustomField(person.userDefined, "context",        contact.context || null);
  if (contact.introducedBy !== undefined) person.userDefined = setCustomField(person.userDefined, "introducedBy",   contact.introducedBy || null);
  // Linked contacts stored as JSON in userDefined so they survive Google sync
  if (contact.linkedContacts !== undefined) {
    person.userDefined = setCustomField(
      person.userDefined, "linkedContacts",
      contact.linkedContacts?.length ? JSON.stringify(contact.linkedContacts) : null
    );
  }

  return person;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const connected = await isConnected();
    if (!connected) return res.status(401).json({ error: "Google Contacts not connected" });

    if (req.method === "GET") {
      const people = await listContacts();
      return res.json(people.map(toContact));
    }

    if (req.method === "POST") {
      const { name, email, phone, city, birthday, groups, from, lastSeen, giftIdeas, context, introducedBy } = req.body;
      const contactData = { name, email, phone, city, birthday, from, lastSeen, giftIdeas, context, introducedBy };
      const googlePerson = toGooglePerson(contactData);

      const created = await createContact(googlePerson);
      const contact = toContact(created);

      // Add to groups
      if (groups && groups.length > 0) {
        for (const groupId of groups) {
          await addContactToGroup(contact.id, groupId).catch(() => {});
        }
      }

      return res.json(contact);
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      let existing = await getContact(id);

      // Handle group membership changes first (modifies person on Google's side)
      if (patch.groups !== undefined) {
        const oldGroups = (existing.memberships || [])
          .map(m => m.contactGroupMembership?.contactGroupResourceName || "")
          .filter(r => /^contactGroups\/\d+$/.test(r));

        const toAdd = (patch.groups || []).filter(g => !oldGroups.includes(g));
        const toRemove = oldGroups.filter(g => !(patch.groups || []).includes(g));

        console.log("group changes — add:", toAdd, "remove:", toRemove);
        for (const groupId of toAdd) {
          await addContactToGroup(id, groupId).catch((e) => console.error("addToGroup failed", groupId, e.message));
        }
        for (const groupId of toRemove) {
          await removeContactFromGroup(id, groupId).catch((e) => console.error("removeFromGroup failed", groupId, e.message));
        }

        // Re-fetch to get fresh etag before any updateContact call below
        if (Object.keys(patch).some(k => k !== "groups")) {
          existing = await getContact(id);
        }
      }

      // Call updateContact for any non-group field changes (including linkedContacts → userDefined)
      const contactFieldKeys = Object.keys(patch).filter(k => k !== "groups");
      if (contactFieldKeys.length > 0) {
        const updated = toGooglePerson(patch, existing);
        const result = await updateContact(id, updated);
        return res.json(toContact(result));
      }

      // Groups-only change: return the current state
      const refreshed = await getContact(id);
      return res.json(toContact(refreshed));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      await deleteContact(id);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("contacts error", err);
    return res.status(500).json({ error: err.message });
  }
}
