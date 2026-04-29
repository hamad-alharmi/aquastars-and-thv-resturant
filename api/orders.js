import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    const WEBHOOK_URL = "https://discord.com/api/webhooks/1499047536986558497/FS_bssmM8WlvdV9GZanThEfQMC8NhfYF1wxH0Au17VeDb43RxYHPCPGFS0jcuO0iXfFZ";

    // 1. CREATE ORDER (POST)
    if (req.method === 'POST') {
        const { name, item, note } = req.body;
        
        try {
            // Send to Discord first to get the Message ID
            const discordRes = await fetch(`${WEBHOOK_URL}?wait=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                        title: "Incoming Dispatch",
                        color: 0x00d4ff,
                        fields: [
                            { name: "Operator", value: name, inline: true },
                            { name: "Selection", value: item, inline: true },
                            { name: "Notes", value: note || "Standard configuration" }
                        ],
                        timestamp: new Date()
                    }]
                })
            });
            const discordData = await discordRes.json();
            const discordMsgId = discordData.id;

            // Save to Vercel Postgres
            await sql`
                INSERT INTO indomie_orders (name, item, note, discord_id)
                VALUES (${name}, ${item}, ${note}, ${discordMsgId});
            `;

            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // 2. GET ALL ORDERS (GET)
    if (req.method === 'GET') {
        try {
            const { rows } = await sql`SELECT * FROM indomie_orders ORDER BY id DESC;`;
            return res.status(200).json(rows);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // 3. CANCEL ORDER (DELETE)
    if (req.method === 'DELETE') {
        const { id, discord_id } = req.query;
        try {
            // Delete from Discord
            await fetch(`${WEBHOOK_URL}/messages/${discord_id}`, { method: 'DELETE' });
            
            // Delete from Database
            await sql`DELETE FROM indomie_orders WHERE id = ${id};`;
            
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
}
