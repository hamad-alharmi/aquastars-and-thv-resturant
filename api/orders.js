export default async function handler(req, res) {
    const WEBHOOK_URL = "https://discord.com/api/webhooks/1499047536986558497/FS_bssmM8WlvdV9GZanThEfQMC8NhfYF1wxH0Au17VeDb43RxYHPCPGFS0jcuO0iXfFZ";
    
    // This bypasses the library and talks to Neon/Vercel Postgres directly via HTTPS
    const DB_URL = process.env.POSTGRES_URL.replace('postgres://', 'https://').split('?')[0] + '/v1/sql';

    const dbQuery = async (sql, params = []) => {
        const response = await fetch(DB_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: sql, params: params })
        });
        return response.json();
    };

    try {
        if (req.method === 'GET') {
            const data = await dbQuery('SELECT * FROM indomie_orders ORDER BY id DESC');
            return res.status(200).json(data.rows || []);
        }

        if (req.method === 'POST') {
            const { name, item, note } = req.body;
            const discordRes = await fetch(`${WEBHOOK_URL}?wait=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                        title: "New Order Received",
                        color: 0xff2d75,
                        fields: [
                            { name: "Customer", value: name, inline: true },
                            { name: "Dish", value: item, inline: true },
                            { name: "Note", value: note || "None" }
                        ]
                    }]
                })
            });
            const discordData = await discordRes.json();

            await dbQuery(
                'INSERT INTO indomie_orders (name, item, note, discord_id) VALUES ($1, $2, $3, $4)', 
                [name, item, note, discordData.id]
            );
            return res.status(200).json({ success: true });
        }

        if (req.method === 'DELETE') {
            const { id, discord_id } = req.query;
            await fetch(`${WEBHOOK_URL}/messages/${discord_id}`, { method: 'DELETE' }).catch(() => {});
            await dbQuery('DELETE FROM indomie_orders WHERE id = $1', [id]);
            return res.status(200).json({ success: true });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
