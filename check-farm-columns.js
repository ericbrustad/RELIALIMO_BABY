// Quick check of farm columns in reservations table
const sk = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY2MzMxMywiZXhwIjoyMDgxMjM5MzEzfQ.AwUvDEQNb_U04OveQ6Ia9wFgoIatwV6wigdwSQnsOP4';

async function checkColumns() {
    const response = await fetch('https://siumiadylwcrkaqsfwkj.supabase.co/rest/v1/reservations?limit=1', {
        headers: {
            apikey: sk,
            Authorization: `Bearer ${sk}`
        }
    });
    const data = await response.json();
    
    if (data && data.length > 0) {
        const cols = Object.keys(data[0]);
        console.log('\n=== All Columns ===');
        console.log(cols.sort().join('\n'));
        
        console.log('\n=== Farm/Status Related Columns ===');
        const farmCols = cols.filter(c => c.includes('farm') || c.includes('status'));
        if (farmCols.length > 0) {
            farmCols.forEach(c => console.log(`${c}: ${JSON.stringify(data[0][c])}`));
        } else {
            console.log('No farm or status columns found!');
        }
    } else {
        console.log('No reservations found');
    }
}

checkColumns().catch(console.error);
