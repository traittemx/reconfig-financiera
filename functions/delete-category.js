import { createClient } from 'https://esm.sh/@insforge/sdk@1.1.5';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function (req) {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('INSFORGE_URL') ?? '',
            Deno.env.get('INSFORGE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization') ?? '' },
                },
            }
        );

        const { category_id, user_id } = await req.json();

        if (!category_id || !user_id) {
            return new Response(JSON.stringify({ error: 'Missing category_id or user_id' }), { status: 400, headers: corsHeaders });
        }

        // Verify ownership
        const { data: doc, error: docError } = await supabase
            .from('categories')
            .select('*')
            .eq('id', category_id)
            .single();

        if (docError || !doc) {
            return new Response(JSON.stringify({ error: 'Category not found' }), { status: 404, headers: corsHeaders });
        }

        if (doc.user_id !== user_id) {
            return new Response(JSON.stringify({ error: 'Category does not belong to user' }), { status: 403, headers: corsHeaders });
        }

        // Delete
        const { error: delError } = await supabase.from('categories').delete().eq('id', category_id);

        if (delError) throw delError;

        return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
}
