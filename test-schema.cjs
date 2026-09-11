const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://absmxrciaasihyqpinlm.supabase.co';
const supabaseKey = 'sb_publishable_rn_0iwmTGj_z1ZaneXBdpw_eSvlUIU_';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('products').select('*').limit(1);
  console.log("active type:", typeof data[0].active);
  console.log("active value:", data[0].active);
}
test();
