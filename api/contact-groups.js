import {
  listContactGroups, createContactGroup, updateContactGroup, deleteContactGroup,
  isConnected
} from "./_google-people.js";
import { setCors, getUid } from "./_supabase.js";
import { getPref, setPref } from "./_prefs.js";

async function loadIcons(uid) {
  const val = await getPref("contact-group-icons", uid);
  return val || {};
}

async function saveIcons(uid, icons) {
  await setPref("contact-group-icons", icons, uid);
}

function toGroup(googleGroup, icons) {
  const resourceName = googleGroup.resourceName || "";
  return {
    id:   resourceName,
    name: googleGroup.name || googleGroup.formattedName || "",
    icon: (icons || {})[resourceName] || "👥",
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const uid = getUid(req) || "";
    const connected = await isConnected();
    if (!connected) return res.status(401).json({ error: "Google Contacts not connected" });

    const icons = await loadIcons(uid);

    if (req.method === "GET") {
      const groups = await listContactGroups();
      const userGroups = groups.filter((g) => g.groupType === "USER_CONTACT_GROUP");
      return res.json(userGroups.map((g) => toGroup(g, icons)));
    }

    if (req.method === "POST") {
      const { name, icon } = req.body;
      const created = await createContactGroup(name);
      const resourceName = created.resourceName || "";
      let updatedIcons = icons;
      if (icon && uid) {
        updatedIcons = { ...icons, [resourceName]: icon };
        await saveIcons(uid, updatedIcons);
      }
      return res.json(toGroup(created, updatedIcons));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      if (patch.name) await updateContactGroup(id, patch.name);

      let updatedIcons = icons;
      if (patch.icon !== undefined && uid) {
        updatedIcons = { ...icons, [id]: patch.icon };
        await saveIcons(uid, updatedIcons);
      }

      const groups = await listContactGroups();
      const updated = groups.find((g) => g.resourceName === id);
      return res.json(toGroup(updated || { resourceName: id, name: patch.name || "" }, updatedIcons));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      try {
        await deleteContactGroup(id);
        if (uid) {
          const { [id]: _dropped, ...rest } = icons;
          await saveIcons(uid, rest);
        }
        return res.json({ ok: true });
      } catch (deleteErr) {
        console.error("DELETE contact-group FAILED:", id, "|", deleteErr.message.slice(0, 300));
        return res.status(500).json({ error: deleteErr.message });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("contact-groups error", err);
    return res.status(500).json({ error: err.message });
  }
}
