const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://absmxrciaasihyqpinlm.supabase.co';
const supabaseKey = 'sb_publishable_rn_0iwmTGj_z1ZaneXBdpw_eSvlUIU_';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  let query = supabase.from('products').select('*', { count: 'exact' });
  query = query.eq('active', false);
  query = query.or(`name.ilike.%carta%`);
  const { data, count, error } = await query;
  console.log("Error:", error);
  console.log("Count with active=false and name like carta:", count);
  console.log("Data length:", data ? data.length : 0);
  if (data && data.length > 0) {
    console.log("Sample active value:", data[0].active);
  }
}
test();
