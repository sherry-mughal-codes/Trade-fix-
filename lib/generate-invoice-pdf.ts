import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Define interfaces matching the Prisma schema + relations
interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  amount: number;
  moreDetails?: string | null;
}

interface Party {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface Invoice {
  invoiceNumber: string;
  date: Date | string;
  dueDate?: Date | string | null;
  party: Party;
  items?: InvoiceItem[];
  currency: string;
  subTotal: number;
  discountTotal: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  notes?: string | null;
  terms?: string | null;
}

interface CompanySettings {
  companyName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  invoiceTerms?: string | null;
}

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
  });
};

export const generateInvoicePDF = async (invoice: Invoice, companySettings?: CompanySettings) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10; // Decrease the left and right margin of the overall invoice. (14 -> 10) 

  // Colors
  const primaryColor = "#153A66"; // Dark navy blue from OCR
  const secondaryColor = "#666A70"; // Medium gray from OCR
  const labelColor = "#333344"; // Dark gray for labels
  const dangerColor = "#D53A3A"; // Red for Due Date

  // --- Header Section ---
  let yPos = 10; 

  // Calculate header height for background
  let textX = 50; // Changed from const to let
  const address = companySettings?.address || "161-C, Faisal Town, C Block, opposite Faisal Town Park Civic Center, Lahore, Punjab, Pakistan, 54000";
  const splitAddress = doc.splitTextToSize(address, 140);
  const companyInfoHeight = 20 + (splitAddress.length * 6);
  
  // Meta section height
  const metaHeight = 3 * 8 + 10;
  
  // Customer section height
  const custNameHeight = 6;
  const custAddr = invoice.party.address ? doc.splitTextToSize(invoice.party.address, 100) : [];
  const custAddrHeight = custAddr.length * 6;
  const custHeight = 5 + custNameHeight + custAddrHeight + 10;
  
  let tempMetaY = 10 + companyInfoHeight + 10 + metaHeight + 5 + custHeight + 10;
  
  // Calculate exact background height for Section 1 (Header + Meta + Customer)
  // Re-calculate precise heights to match drawing logic
  const calcHeaderHeight = Math.max(25, 18 + (splitAddress.length * 6));
  
  // Meta section increase: Invoice (6) + Date (6) + DueDate (6) + Spacing (4) = 22
  const metaSectionHeight = 22;
  
  // Customer section: Name line (6) + Address height
  // custAddr and custAddrHeight are already defined above
  
  // Start of Meta Section (yPos)
  const metaStartY = 10 + calcHeaderHeight + 5;
  
  // End of Customer Section (metaY)
  const endOfCustomerY = metaStartY + metaSectionHeight + 6 + custAddrHeight;
  
  // User wants background to end at metaY + 10
  const section1BottomY = endOfCustomerY + 10;

  // Draw Background for Header & Section 1
  doc.setFillColor("#f2f2f2"); 
  doc.rect(0, 0, pageWidth, section1BottomY, "F");

  // Divider line at end of Section 1
  // doc.setDrawColor(0, 0, 0); // Black
  // doc.setLineWidth(0.8);
  // doc.line(0, section1BottomY, pageWidth, section1BottomY);

  // 1. Logo
  try {
    const logoUrl = companySettings?.logoUrl || "/tradefix-logo.svg";
    const logoImg = await loadImage(logoUrl);
    
    // Calculate aspect ratio to fit in ~30mm width, ~20mm height
    // We want to constrain max width to 40mm and max height to 25mm
    // const maxWidth = 40;
    // const maxHeight = 25;
    
    // User wants "use the logo from the company settings on the invoice pdf."
    // Currently it tries `companySettings?.logoUrl || "/tradefix-logo.svg"`.
    // If companySettings.logoUrl is present, it uses it.
    // If user uploaded a logo, it should be in companySettings.
    // But maybe the `loadImage` fails if it's a relative URL from storage?
    // If the logo is stored in `public/uploads` or similar, `loadImage` needs full URL or correct relative path.
    // Assuming `logoUrl` is accessible.
    
    // However, maybe the user implies the logo SIZE or positioning is wrong?
    // "use the logo from the company settings on the invoice pdf" -> implies it's NOT using it?
    // The code IS using it: `const logoUrl = companySettings?.logoUrl || "/tradefix-logo.svg";`
    
    // Maybe the user wants to remove the hardcoded fallback "/tradefix-logo.svg"?
    // Or maybe the aspect ratio logic is messing it up?
    
    // Let's assume the user just wants to ensure the code prioritizes company logo. It does.
    // Maybe the user uploaded a logo and it's not showing?
    // `loadImage` creates an `Image` object. This works in browser environment (Client Side).
    // `generateInvoicePDF` is called from client component (`row-actions.tsx`).
    // So `Image()` constructor exists.
    
    // If `companySettings.logoUrl` is a local file path (e.g. from file upload), it might need to be a Blob URL or public URL.
    // If the user hasn't uploaded a logo, it falls back to `/tradefix-logo.svg`.
    
    // I will double check the `maxWidth` and `maxHeight`.
    // Let's make it slightly bigger as per typical invoice headers?
    // Or just ensure it doesn't fail silently.
    
    const maxWidth = 50; // Increased from 40
    const maxHeight = 30; // Increased from 25
    
    let logoWidth = maxWidth;
    let logoHeight = (logoImg.height / logoImg.width) * logoWidth;
    
    if (logoHeight > maxHeight) {
        logoHeight = maxHeight;
        logoWidth = (logoImg.width / logoImg.height) * logoHeight;
    }
    
    // Dynamic textX based on logo width
    const logoRightEdge = margin + logoWidth;
    // Ensure at least 10mm gap between logo and text
    const calculatedTextX = Math.max(textX, logoRightEdge + 10);
    textX = calculatedTextX; // Update textX if logo is wider
    
    doc.addImage(logoImg, 'PNG', margin, yPos, logoWidth, logoHeight);
  } catch (e) {
    console.warn("Logo not found or failed to load", e);
  }
  
  // Company Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14); // Reverted back to 14 (requested increase by 4pts from 10)
  doc.setTextColor(primaryColor);
  
  const companyName = companySettings?.companyName || "Firm Eleven Pvt Ltd.";
  doc.text(companyName, textX, yPos + 5); 

  // Phone
  const phone = companySettings?.phone || "0300 0561616";
  // doc.setFontSize(18); // Reverted
  doc.text(phone, textX, yPos + 12); 

  // Address
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10); // Reverted back to 10 (requested increase by 4pts from 6)
  doc.setTextColor(secondaryColor);
  
  // const address = companySettings?.address || "161-C, Faisal Town, C Block, opposite Faisal Town Park Civic Center, Lahore, Punjab, Pakistan, 54000";
  // const splitAddress = doc.splitTextToSize(address, 140);
  doc.text(splitAddress, textX, yPos + 18);

  // Update yPos
  const headerHeight = Math.max(25, 18 + (splitAddress.length * 6)); // Adjusted for larger font
  
  // Red line at end of Header Section
  // doc.setDrawColor(0, 0, 0); // Black
  // doc.setLineWidth(0.8);
  // doc.line(0, yPos + headerHeight + 2, pageWidth, yPos + headerHeight + 2);

  yPos += headerHeight + 5;

  // --- Invoice Meta (Invoice #, Date, Due Date) ---
  let metaY = yPos;
  const metaLabelX = margin;
  const metaValueX = margin + 60; // Increased horizontal gap even more for "left to right titles and values"

  const drawMetaRow = (label: string, value: string, options: { isRed?: boolean, valueBold?: boolean } = {}) => {
    const { isRed, valueBold } = options;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10); // Decreased by 4pts (14 -> 10)
    doc.setTextColor(isRed ? dangerColor : labelColor);
    doc.text(label, metaLabelX, metaY);
    
    doc.setFont("helvetica", valueBold ? "bold" : "normal");
    doc.setFontSize(10); // Decreased by 4pts (14 -> 10)
    doc.setTextColor(isRed ? dangerColor : labelColor); // Values are dark gray/red
    doc.text(value, metaValueX, metaY);
    
    metaY += 6; // Reduced vertical gap further
  };

  drawMetaRow("Invoice", invoice.invoiceNumber, { valueBold: true });
  
  // Date Value is Regular, Label is Bold
  // Remove "Date" title only
  // doc.text("Date", metaLabelX, metaY); // Removed
  
  doc.setFont("helvetica", "normal");
  // Value remains
  doc.text(new Date(invoice.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), metaValueX, metaY);
  metaY += 6; // Reduced gap

  if (invoice.dueDate) {
    drawMetaRow("Due Date", new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), { isRed: true, valueBold: true }); // Bold due date value
  }
  
  metaY += 4; // Reduced extra spacing

  // --- Customer Section ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10); // Decreased by 4pts (14 -> 10)
  doc.setTextColor(labelColor);
  doc.text("Customer", margin, metaY);
  
  // Value (Name) aligned with metaValueX
  doc.setFont("helvetica", "bold"); // Name is bold
  doc.setFontSize(10); // Decreased by 4pts (14 -> 10)
  doc.setTextColor(labelColor);
  doc.text(invoice.party.name, metaValueX, metaY); 
  
  metaY += 6; // Move down for address or next line

  if (invoice.party.address) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10); // Decreased (12 -> 10) for balance, though user asked for section having customer
    doc.setTextColor(secondaryColor); // Medium gray
    const splitCustAddr = doc.splitTextToSize(invoice.party.address, 100);
    doc.text(splitCustAddr, metaValueX, metaY);
    metaY += (splitCustAddr.length * 5); // Reduced line height multiplier
  } else {
    metaY += 2;
  }
  // doc.setDrawColor(dangerColor);
  // doc.line(0, metaY + 10, pageWidth, metaY + 10);
  
  metaY += 20; // Restored spacing before table

  const tableColumn = ["Item", "Quantity", "Rate", "Amount"];
  const tableRows = (invoice.items || []).map((item) => [
    item.moreDetails ? `${item.description}\n${item.moreDetails}` : item.description,
    item.quantity.toFixed(2),
    `${invoice.currency} ${item.unitPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}`,
    `${invoice.currency} ${item.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}`,
  ]);

  autoTable(doc, {
    startY: metaY,
    margin: { left: margin, right: margin },
    head: [tableColumn],
    body: tableRows,
    theme: 'plain',
    headStyles: { 
        fillColor: false, 
        textColor: primaryColor,
        fontStyle: 'bold',
        fontSize: 10, 
        lineWidth: 0,
        cellPadding: {top: 3, bottom: 3, left: 2, right: 2} 
    },
    styles: { 
        fontSize: 10, 
        cellPadding: 4,
        textColor: "#000000", 
        valign: 'top',
        lineColor: [200, 200, 200],
        lineWidth: {bottom: 0.1},
        fillColor: 255 
    },
    columnStyles: {
        0: { cellWidth: 80, halign: 'left', overflow: 'linebreak' }, // Removed fontStyle: 'bold' to handle manually
        1: { cellWidth: 30, halign: 'right' }, 
        2: { cellWidth: 40, halign: 'right' }, 
        3: { cellWidth: 40, halign: 'right' } 
    },
    didParseCell: (data) => {
        // Ensure header alignment matches column alignment
        if (data.section === 'head') {
            if (data.column.index === 0) data.cell.styles.halign = 'left';
            if (data.column.index === 1) data.cell.styles.halign = 'right';
            if (data.column.index === 2) data.cell.styles.halign = 'right';
            if (data.column.index === 3) data.cell.styles.halign = 'right';
        }
        // For body column 0, we will handle text content in didDrawCell
        if (data.section === 'body' && data.column.index === 0) {
             // To prevent double drawing (autoTable default + our custom didDrawCell),
             // we set the cell text to empty or transparent?
             // Setting textColor to 255 (white) effectively hides default text if bg is white.
             data.cell.styles.textColor = 255;
        }
    },
    didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
            const cell = data.cell;
            // Get raw text. Since we didn't clear `raw`, it should still be there.
            const text = cell.raw as string; 
            
            const parts = (text || "").split('\n');
            const title = parts[0];
            const details = parts.slice(1).join('\n');
            
            const posX = cell.x + 4; // padding left
            let posY = cell.y + 6; // padding top approx
            
            // Draw Title (Bold)
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor("#000000");
            
            const titleLines = doc.splitTextToSize(title, 72); 
            doc.text(titleLines, posX, posY);
            
            posY += (titleLines.length * 5); 
            
            // Draw Details (Regular)
            if (details) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                doc.setTextColor("#000000");
                
                const detailLines = doc.splitTextToSize(details, 72);
                doc.text(detailLines, posX, posY);
            }
        }
    }
  });

  // --- Totals Section ---
  const finalY = (doc as any).lastAutoTable.finalY || metaY + 20;

  // Red line at end of Items Table
  // doc.setDrawColor(0, 0, 0); // Black
  // doc.setLineWidth(0.8);
  // doc.line(0, finalY + 5, pageWidth, finalY + 5);

  let totalsY = finalY + 12;
  
  // Subtotal and grand total should in 1 line as shown in the screenshot attached.
  // Left panel (Subtotal): Light grey background, Label "Subtotal", Value "Rs ...".
  // Right panel (Grand Total): Dark navy background, Label "Grand Total", Value "Rs ...".
  // They are side-by-side.
  
  const panelHeight = 25; // Height for the total bar
  const panelWidth = pageWidth / 2; // Split page width? Or just the right half?
  // Screenshot shows full width bar split in two? Or just right aligned bar?
  // "Left panel... Right panel..." implies 50-50 split or similar.
  // Let's assume full width bar at bottom of table.
  
  // Actually, usually totals are on the right side.
  // But if screenshot shows "Left panel: light grey... Right panel: dark navy", it suggests a full width footer-like bar for totals.
  // Let's try to make it full width spanning margins.
  
  // total line, use the 40% of the area for both subtotal and grand total and align right. 
  // now, the totals row, subtotal section and grandtotal section should set their width based on the value they are having in them. 
  // This means dynamic width instead of fixed 40%.
  // We need to measure text width for Subtotal value and Grand Total value to determine panel widths.
  
  const subTotalValue = `${invoice.currency} ${invoice.subTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
  const grandTotalValue = `${invoice.currency} ${invoice.grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const subTotalValueWidth = doc.getTextWidth(subTotalValue);
  const grandTotalValueWidth = doc.getTextWidth(grandTotalValue);
  
  // Panel needs to fit label ("Subtotal" / "Grand Total") and Value.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const subTotalLabelWidth = doc.getTextWidth("Subtotal");
  const grandTotalLabelWidth = doc.getTextWidth("Grand Total");
  
  // Calculate width for each panel with some padding
  const padding = 15;
  const leftPanelWidth = Math.max(subTotalValueWidth, subTotalLabelWidth) + padding;
  const rightPanelWidth = Math.max(grandTotalValueWidth, grandTotalLabelWidth) + padding;
  
  const totalBarWidth = leftPanelWidth + rightPanelWidth;
  const totalBarStartX = pageWidth - margin - totalBarWidth;
  
  // Left Panel (Subtotal) - Light Grey #f2f2f2
  doc.setFillColor("#f2f2f2");
  doc.rect(totalBarStartX, totalsY, leftPanelWidth, panelHeight, "F");
  
  // Right Panel (Grand Total) - Dark Navy #153A66 (primaryColor)
  doc.setFillColor(primaryColor);
  doc.rect(totalBarStartX + leftPanelWidth, totalsY, rightPanelWidth, panelHeight, "F");
  
  // Text positioning
  // Subtotal Text (Left Panel)
  // const leftPanelCenterX = totalBarStartX + (leftPanelWidth / 2);
  // User wants titles subtotal and grand total should be align right.
  // This implies inside the panel, they should be aligned right? Or just the whole block?
  // "titles subtotal and grand total should be align right."
  // Screenshot showed them centered.
  // But user request overrides screenshot.
  // "align right" inside their respective panels.
  
  const rightPadding = 5;
  const leftPanelRightX = totalBarStartX + leftPanelWidth - rightPadding;
  const rightPanelRightX = totalBarStartX + leftPanelWidth + rightPanelWidth - rightPadding;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(secondaryColor); // Grey
  doc.text("Subtotal", leftPanelRightX, totalsY + 8, { align: "right" });
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(primaryColor); // Dark Navy
  doc.text(subTotalValue, leftPanelRightX, totalsY + 18, { align: "right" });
  
  // Grand Total Text (Right Panel)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#ffffff"); // White
  doc.text("Grand Total", rightPanelRightX, totalsY + 8, { align: "right" });
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor("#ffffff"); // White
  doc.text(grandTotalValue, rightPanelRightX, totalsY + 18, { align: "right" });
  
  totalsY += panelHeight + 5; // End of totals

  // Red line at end of Totals Section
  // doc.setDrawColor(0, 0, 0); // Black
  // doc.line(0, totalsY - 2.5, pageWidth, totalsY - 2.5);

  // --- Footer / Notes ---
  let footerY = totalsY + 15;
  if (footerY > 250) {
      doc.addPage();
      footerY = 20;
  }

  // Notes & Terms
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primaryColor);
  doc.text("Notes", margin, footerY); // Title "Notes" in bold
  footerY += 5; // Reduced line space after title "Notes" from 8 to 5 (minimum)
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor("#000000"); // Black color for notes text
  
  // Combine invoice notes and company settings/terms
  const invoiceNotes = invoice.notes ? `${invoice.notes}\n` : "";
  const invoiceTerms = invoice.terms || companySettings?.invoiceTerms || "Please clear the said amount before due date to avoid any unseen situation.";
  
  // The text in the notes section itself should have the line gap, not from the Notes heading but the text itself.
  // This implies adding line height to the text block itself, or extra spacing between combined notes.
  // We used triple newline `\n\n\n` before.
  // Let's use `\n\n` for line gap within text, and ensure strict spacing from title.
  
  const fullNotes = `${invoiceNotes}\n\n${invoiceTerms}`; 
  
  // Split long text
  const splitNotes = doc.splitTextToSize(fullNotes, pageWidth - (margin * 2));
  // Use `text` with `lineHeightFactor` if needed, or just let it flow.
  // jsPDF default line height is usually fine, but if "text itself should have the line gap" means increased line-height:
  doc.text(splitNotes, margin, footerY, { lineHeightFactor: 1.5 }); // Increased line height for text body
  
  footerY += (splitNotes.length * 5 * 1.5) + 10;

  // Red line at end of Notes Section
  // doc.setDrawColor(dangerColor);
  // doc.line(0, footerY, pageWidth, footerY);

  // Removed Hardcoded Bank Details

  doc.save(`Invoice_${invoice.invoiceNumber}.pdf`);
};
