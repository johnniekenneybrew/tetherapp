import {
  listContactGroups, createContactGroup, updateContactGroup, deleteContactGroup,
  isConnected
} from "./_google-people.js";
import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

// Notion DB stores icon preferences (minimal storage)
let iconCacheReady = false;
const iconCache = {}; // groupResourceName -> icon

async function ensureIconCache() {
  if (iconCacheReady) return;
  try {
    const pages = await queryAll(DB.CONTACT_GROUPS);
    for (const page of pages) {
      const resourceName = p.rich(page.properties["Resource Name"]);
      const icon = p.rich(page.properties.Icon) || "👥";
      if (resourceName) iconCache[resourceName] = icon;
    }
    iconCacheReady = true;
  } catch (e) {
    console.error("ensureIconCache failed", e);
    iconCacheReady = true;
  }
}

async function ensureGroupSchema() {
  try {
    const db = await notion.databases.retrieve({ database_id: DB.CONTACT_GROUPS });
    const updates = {};
    if (!db.properties["Resource Name"]) updates["Resource Name"] = { rich_text: {} };
    if (Object.keys(updates).length > 0) {
      await notion.databases.update({ database_id: DB.CONTACT_GROUPS, properties: updates });
    }
  } catch (e) {
    console.error("ensureGroupSchema failed", e);
  }
}

async function saveIconToNotion(resourceName, name, icon) {
  try {
    // Check if already exists
    const pages = await queryAll(DB.CONTACT_GROUPS, {
      filter: { property: "Resource Name", rich_text: { equals: resourceName } }
    });

    if (pages.length > 0) {
      // Update existing
      await notion.pages.update({
        page_id: pages[0].id,
        properties: { Icon: P.rich(icon) }
      });
    } else {
      // Create new
      await notion.pages.create({
        parent: { database_id: DB.CONTACT_GROUPS },
        properties: {
          Name: P.title(name),
          "Resource Name": P.rich(resourceName),
          Icon: P.rich(icon),
        }
      });
    }
    iconCache[resourceName] = icon;
  } catch (e) {
    console.error("saveIconToNotion failed", e);
  }
}

async function deleteIconFromNotion(resourceName) {
  try {
    const pages = await queryAll(DB.CONTACT_GROUPS, {
      filter: { property: "Resource Name", rich_text: { equals: resourceName } }
    });

    if (pages.length > 0) {
      await notion.pages.update({
        page_id: pages[0].id,
        archived: true
      });
    }
    delete iconCache[resourceName];
  } catch (e) {
    console.error("deleteIconFromNotion failed", e);
  }
}

function toGroup(googleGroup) {
  const resourceName = googleGroup.resourceName || "";
  return {
    id: resourceName,
    name: googleGroup.name || googleGroup.formattedName || "",
    icon: iconCache[resourceName] || "👥",
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    await ensureIconCache();
    await ensureGroupSchema();

    const connected = await isConnected();
    if (!connected) return res.status(401).json({ error: "Google Contacts not connected" });

    if (req.method === "GET") {
      const groups = await listContactGroups();
      // Filter out system groups (myContacts, starred, etc.)
      const userGroups = groups.filter(g => g.groupType === "USER_CONTACT_GROUP");
      return res.json(userGroups.map(toGroup));
    }

    if (req.method === "POST") {
      const { name, icon } = req.body;
      const created = await createContactGroup(name);
      // Google returns the ContactGroup directly (not wrapped in contactGroup)
      const resourceName = created.resourceName || "";

      // Save icon to Notion
      if (icon) {
        await saveIconToNotion(resourceName, name, icon);
      }

      return res.json(toGroup(created));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      if (patch.name) {
        await updateContactGroup(id, patch.name);
      }

      if (patch.icon) {
        await saveIconToNotion(id, patch.name, patch.icon);
      }

      const updated = await getContactGroup(id);
      return res.json(toGroup(updated));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      try {
        await deleteContactGroup(id);
        await deleteIconFromNotion(id);
        console.log("DELETE contact-group OK:", id);
        return res.json({ ok: true });
      } catch (deleteErr) {
        console.log("DELETE contact-group FAILED:", id, "|", deleteErr.message.slice(0, 300));
        return res.status(500).json({ error: deleteErr.message });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("contact-groups error", err);
    return res.status(500).json({ error: err.message });
  }
}

async function getContactGroup(resourceName) {
  // Fetch from Google to get latest data
  const groups = await listContactGroups();
  return groups.find(g => g.resourceName === resourceName);
}
