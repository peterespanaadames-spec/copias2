const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://absmxrciaasihyqpinlm.supabase.co';
const supabaseKey = 'sb_publishable_rn_0iwmTGj_z1ZaneXBdpw_eSvlUIU_';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, count, error } = await supabase.from('products').select('*', { count: 'exact' }).eq('active', true);
  console.log("Active Error:", error);
  console.log("Active Count:", count, "Data length:", data ? data.length : 0);

  const { data: data2, count: count2, error: error2 } = await supabase.from('products').select('*', { count: 'exact' }).eq('active', false);
  console.log("Inactive Error:", error2);
  console.log("Inactive Count:", count2, "Data length:", data2 ? data2.length : 0);
}
test();
