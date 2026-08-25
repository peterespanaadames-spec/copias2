const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://absmxrciaasihyqpinlm.supabase.co';
const supabaseKey = 'sb_publishable_rn_0iwmTGj_z1ZaneXBdpw_eSvlUIU_';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: prods } = await supabase.from('products').select('*').limit(1);
  if (!prods || prods.length === 0) return;
  const p = prods[0];
  const { data, error } = await supabase.from('products').update({ active: !p.active }).eq('id', p.id).select();
  console.log("Update error:", error);
  console.log("Update data:", data);
}
test();
