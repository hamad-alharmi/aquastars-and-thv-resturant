import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    const WEBHOOK_URL = "https://discord.com/api/webhooks/1499047536986558497/FS_bssmM8WlvdV9GZanThEfQMC8NhfYF1wxH0Au17VeDb43RxYHPCPGFS0jcuO0iXfFZ";

    try {
        // 1. GET ALL ORDERS (GET)
        if (req.method === 'GET') {
            const { rows } = await sql`SELECT * FROM indomie_orders ORDER BY id DESC;`;
            return res.status(200).json(rows);
        }

        // 2. CREATE ORDER (POST)
        if (req.method === 'POST') {
            const { name, item, note } = req.body;
            
            // Dispatch to Discord
            const discordRes = await fetch(`${WEBHOOK_URL}?wait=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                        title: "New Order Received",
                        color: 0x00d4ff,
                        fields: [
                            { name: "Customer", value: name, inline: true },
                            { name: "Dish", value: item, inline: true },
                            { name: "Special Requests", value: note || "None" }
                        ],
                        timestamp: new Date()
                    }]
                })
            });
            const discordData = await discordRes.json();

            // Insert into Postgres
            await sql`
                INSERT INTO indomie_orders (name, item, note, discord_id)
                VALUES (${name}, ${item}, ${note}, ${discordData.id});
            `;

            return res.status(200).json({ success: true });
        }

        // 3. DELETE ORDER (DELETE)
        if (req.method === 'DELETE') {
            const { id, discord_id } = req.query;
            
            // Try to wipe from Discord (even if it fails, we continue)
            await fetch(`${WEBHOOK_URL}/messages/${discord_id}`, { method: 'DELETE' }).catch(() => {});
            
            // Wipe from Database
            await sql`DELETE FROM indomie_orders WHERE id = ${id};`;
            
            return res.status(200).json({ success: true });
        }

    } catch (error) {
        console.error("Database Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
