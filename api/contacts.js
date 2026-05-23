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
      .filter(m => !m.contactGroupMembership?.contactGroupResourceName?.includes("myContacts"))
      .map(m => m.contactGroupMembership?.contactGroupResourceName || ""),
    linkedContacts: relations.map(r => ({
      id: r.person?.resourceName || "",
      name: r.person?.names?.[0]?.displayName || "",
      relationship: r.relationshipType || "other"
    })),
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
  const person = existingPerson || {};

  // Names
  person.names = [{
    displayName: contact.name || "",
    givenName: contact.name?.split(" ")[0] || "",
    familyName: contact.name?.split(" ").slice(1).join(" ") || "",
  }];

  // Email
  if (contact.email) {
    person.emailAddresses = [{ value: contact.email, type: "work" }];
  }

  // Phone
  if (contact.phone) {
    person.phoneNumbers = [{ value: contact.phone, type: "mobile" }];
  }

  // Address (city)
  if (contact.city) {
    person.addresses = [{ city: contact.city, type: "work" }];
  }

  // Birthday (YYYY-MM-DD format)
  if (contact.birthday) {
    const parts = contact.birthday.split("-").map(Number);
    if (parts.length === 3) {
      person.birthdays = [{ date: {
        year: parts[0] || undefined,
        month: parts[1],
        day: parts[2]
      } }];
    }
  }

  // Custom fields
  person.userDefined = existingPerson?.userDefined || [];
  person.userDefined = setCustomField(person.userDefined, "from", contact.from || null);
  person.userDefined = setCustomField(person.userDefined, "lastSeen", contact.lastSeen || null);
  person.userDefined = setCustomField(person.userDefined, "giftIdeas", contact.giftIdeas || null);
  person.userDefined = setCustomField(person.userDefined, "context", contact.context || null);
  person.userDefined = setCustomField(person.userDefined, "introducedBy", contact.introducedBy || null);

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

      const existing = await getContact(id);

      // Handle group membership changes
      if (patch.groups !== undefined) {
        const oldGroups = (existing.memberships || [])
          .filter(m => !m.contactGroupMembership?.contactGroupResourceName?.includes("myContacts"))
          .map(m => m.contactGroupMembership?.contactGroupResourceName || "");

        const toAdd = (patch.groups || []).filter(g => !oldGroups.includes(g));
        const toRemove = oldGroups.filter(g => !(patch.groups || []).includes(g));

        console.log("group changes — add:", toAdd, "remove:", toRemove);
        for (const groupId of toAdd) {
          await addContactToGroup(id, groupId).catch((e) => console.error("addToGroup failed", groupId, e.message));
        }
        for (const groupId of toRemove) {
          await removeContactFromGroup(id, groupId).catch((e) => console.error("removeFromGroup failed", groupId, e.message));
        }
      }

      // Only call updateContact if non-group/non-linkedContacts fields are being changed.
      // Skipping this when only groups change avoids: (1) clearing the contact name with an empty
      // partial patch, and (2) an etag conflict caused by the membership modifications above.
      const contactFieldKeys = Object.keys(patch).filter(k => k !== "groups" && k !== "linkedContacts");
      if (contactFieldKeys.length > 0) {
        // Re-fetch to get the fresh etag after any membership modifications
        const fresh = await getContact(id);
        const updated = toGooglePerson(patch, fresh);
        const result = await updateContact(id, updated);
        return res.json(toContact(result));
      }

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
