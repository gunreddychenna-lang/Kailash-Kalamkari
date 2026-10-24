// Debug script to check image URLs being generated
// Run this in browser console to diagnose image loading issues

function debugImageUrls() {
    if (typeof allProducts === 'undefined' || allProducts.length === 0) {
        console.log('❌ No products loaded yet');
        return;
    }

    console.log(`%c=== IMAGE URL DEBUG (${allProducts.length} products) ===`, 'color: blue; font-weight: bold');
    
    allProducts.slice(0, 5).forEach((product, index) => {
        console.group(`Product ${index + 1}: ${product.code || product.fabric}`);
        
        console.log('Raw data:', {
            imageId: product.imageId,
            imageLink: product.imageLink,
            thumbnail: product.thumbnail,
            image: product.image
        });
        
        // Test extraction
        const fileId = extractDriveFileId(product.imageId) || 
                       extractDriveFileId(product.imageLink) || 
                       extractDriveFileId(product.thumbnail);
        
        console.log('Extracted File ID:', fileId || '❌ NOT FOUND');
        
        if (fileId) {
            const cdnUrl = buildCdnImageUrl(fileId, 800);
            const driveUrl = buildDirectDriveUrl(fileId);
            
            console.log('Generated URLs:', {
                'Google CDN': cdnUrl,
                'Google Drive Direct': driveUrl
            });
            
            // Test fetch to see if URLs are accessible
            console.log('Testing URL accessibility...');
            fetch(cdnUrl, { method: 'HEAD' })
                .then(r => console.log(`✅ CDN URL works (${r.status})`))
                .catch(e => console.log(`❌ CDN URL failed: ${e.message}`));
                
            fetch(driveUrl, { method: 'HEAD' })
                .then(r => console.log(`✅ Drive URL works (${r.status})`))
                .catch(e => console.log(`❌ Drive URL failed: ${e.message}`));
        }
        
        // Show actual image URL being used
        const actualUrl = getProductImageUrl(product);
        console.log('Final URL used:', actualUrl.substring(0, 100) + '...');
        
        console.groupEnd();
    });
}

// Run automatically if this script is included
if (typeof allProducts !== 'undefined') {
    console.log('Debug script loaded. Call debugImageUrls() to test.');
} else {
    console.log('Waiting for products to load...');
}
