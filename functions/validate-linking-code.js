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

        const { p_code } = await req.json();

        if (!p_code) {
            return new Response(JSON.stringify({ valid: false, org_name: null }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const { data, error } = await supabase
            .from('organizations')
            .select('name')
            .eq('linking_code', p_code)
            .single();

        if (error || !data) {
            return new Response(JSON.stringify({ valid: false, org_name: null }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        return new Response(JSON.stringify({ valid: true, org_name: data.name }), {
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
