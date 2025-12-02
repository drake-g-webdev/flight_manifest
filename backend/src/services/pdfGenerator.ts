/**
 * PDF Manifest Generator
 *
 * Generates printable PDF manifests from manifest JSON data.
 * Uses Puppeteer to render HTML template to PDF.
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import prisma from '../config/database.js';
import type { ManifestJSON } from '../types/index.js';

const PDF_STORAGE_PATH = process.env.PDF_STORAGE_PATH || './storage/manifests';

/**
 * Ensure storage directory exists
 */
async function ensureStorageDir(): Promise<void> {
  try {
    await fs.access(PDF_STORAGE_PATH);
  } catch {
    await fs.mkdir(PDF_STORAGE_PATH, { recursive: true });
  }
}

/**
 * Generate HTML template for manifest
 */
function generateManifestHTML(manifest: ManifestJSON): string {
  const formatWeight = (kg: number) => kg.toFixed(1);
  const formatCG = (cg: number) => cg.toFixed(2);

  const warningsHTML =
    manifest.warnings.length > 0
      ? `
    <div class="warnings">
      <h3>Warnings</h3>
      <ul>
        ${manifest.warnings.map(w => `<li>${w}</li>`).join('')}
      </ul>
    </div>
  `
      : '';

  const passengersHTML =
    manifest.passengers.length > 0
      ? `
    <table class="data-table">
      <thead>
        <tr>
          <th>Seat</th>
          <th>Name</th>
          <th>Weight (kg)</th>
          <th>Bags (kg)</th>
          <th>Destination</th>
          <th>Priority</th>
        </tr>
      </thead>
      <tbody>
        ${manifest.passengers
          .map(
            p => `
          <tr>
            <td>${p.seat}</td>
            <td>${p.name}</td>
            <td>${formatWeight(p.weightKg)}</td>
            <td>${formatWeight(p.bagsKg)}</td>
            <td>${p.destination}</td>
            <td class="priority-${p.priority.toLowerCase()}">${p.priority}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `
      : '<p class="empty">No passengers</p>';

  const freightHTML =
    manifest.freight.length > 0
      ? `
    <table class="data-table">
      <thead>
        <tr>
          <th>Waybill</th>
          <th>Description</th>
          <th>Weight (kg)</th>
          <th>Destination</th>
          <th>Compartment</th>
        </tr>
      </thead>
      <tbody>
        ${manifest.freight
          .map(
            f => `
          <tr>
            <td>${f.waybill}</td>
            <td>${f.description}</td>
            <td>${formatWeight(f.weightKg)}</td>
            <td>${f.destination}</td>
            <td>${f.compartment}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `
      : '<p class="empty">No freight</p>';

  const mailHTML =
    manifest.mail.length > 0
      ? `
    <table class="data-table">
      <thead>
        <tr>
          <th>Village</th>
          <th>Pounds</th>
          <th>Weight (kg)</th>
        </tr>
      </thead>
      <tbody>
        ${manifest.mail
          .map(
            m => `
          <tr>
            <td>${m.village}</td>
            <td>${m.pounds.toFixed(1)}</td>
            <td>${formatWeight(m.weightKg)}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `
      : '<p class="empty">No mail</p>';

  const routeHTML = manifest.route
    .map(leg => `<span class="leg">${leg.to} (ETA: ${leg.eta.split('T')[1]?.substring(0, 5) || leg.eta})</span>`)
    .join(' → ');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Flight Manifest - ${manifest.manifestId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Arial', sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #333;
      padding: 20px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }

    .header-left h1 {
      font-size: 18px;
      margin-bottom: 5px;
    }

    .header-left .manifest-id {
      font-size: 10px;
      color: #666;
    }

    .header-right {
      text-align: right;
    }

    .header-right .date {
      font-size: 14px;
      font-weight: bold;
    }

    .flight-info {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 15px;
      padding: 10px;
      background: #f5f5f5;
      border-radius: 4px;
    }

    .flight-info-item {
      text-align: center;
    }

    .flight-info-item label {
      font-size: 9px;
      color: #666;
      text-transform: uppercase;
      display: block;
    }

    .flight-info-item .value {
      font-size: 14px;
      font-weight: bold;
    }

    .route-info {
      margin-bottom: 15px;
      padding: 8px;
      background: #e8f4ff;
      border-radius: 4px;
    }

    .route-info label {
      font-size: 9px;
      color: #666;
      text-transform: uppercase;
    }

    .route-info .leg {
      font-weight: bold;
      margin: 0 5px;
    }

    .section {
      margin-bottom: 15px;
    }

    .section h2 {
      font-size: 12px;
      background: #333;
      color: white;
      padding: 5px 10px;
      margin-bottom: 5px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
    }

    .data-table th,
    .data-table td {
      border: 1px solid #ddd;
      padding: 5px 8px;
      text-align: left;
    }

    .data-table th {
      background: #f0f0f0;
      font-weight: bold;
      font-size: 10px;
    }

    .data-table td {
      font-size: 10px;
    }

    .data-table tr:nth-child(even) {
      background: #fafafa;
    }

    .priority-medical,
    .priority-evac {
      color: #c00;
      font-weight: bold;
    }

    .priority-first_class {
      color: #060;
    }

    .totals-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 15px;
    }

    .total-box {
      padding: 10px;
      background: #f5f5f5;
      border-radius: 4px;
      text-align: center;
    }

    .total-box label {
      font-size: 9px;
      color: #666;
      text-transform: uppercase;
      display: block;
    }

    .total-box .value {
      font-size: 16px;
      font-weight: bold;
    }

    .wb-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 15px;
    }

    .wb-summary {
      padding: 10px;
      background: #e8ffe8;
      border-radius: 4px;
    }

    .wb-summary.invalid {
      background: #ffe8e8;
    }

    .wb-summary h3 {
      font-size: 11px;
      margin-bottom: 8px;
    }

    .wb-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .wb-item label {
      font-size: 10px;
    }

    .wb-item .value {
      font-weight: bold;
    }

    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      font-weight: bold;
      font-size: 10px;
    }

    .status-ok {
      background: #0a0;
      color: white;
    }

    .status-error {
      background: #c00;
      color: white;
    }

    .warnings {
      padding: 10px;
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
      margin-bottom: 15px;
    }

    .warnings h3 {
      font-size: 11px;
      margin-bottom: 5px;
    }

    .warnings ul {
      margin-left: 20px;
      font-size: 10px;
    }

    .signature-section {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }

    .signature-box {
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    .signature-box label {
      font-size: 9px;
      color: #666;
      text-transform: uppercase;
    }

    .signature-line {
      border-bottom: 1px solid #333;
      height: 40px;
      margin-top: 10px;
    }

    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: 9px;
      color: #666;
      display: flex;
      justify-content: space-between;
    }

    .empty {
      padding: 10px;
      color: #666;
      font-style: italic;
    }

    @media print {
      body {
        padding: 10px;
      }

      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>FLIGHT MANIFEST</h1>
      <div class="manifest-id">${manifest.manifestId} (v${manifest.version})</div>
    </div>
    <div class="header-right">
      <div class="date">${manifest.flightDate}</div>
      <div>Generated: ${new Date(manifest.generatedAt).toLocaleString()}</div>
    </div>
  </div>

  <div class="flight-info">
    <div class="flight-info-item">
      <label>Flight #</label>
      <div class="value">${manifest.flightNumber}</div>
    </div>
    <div class="flight-info-item">
      <label>Aircraft</label>
      <div class="value">${manifest.tail} (${manifest.aircraftType})</div>
    </div>
    <div class="flight-info-item">
      <label>Pilot</label>
      <div class="value">${manifest.pilot}</div>
    </div>
    <div class="flight-info-item">
      <label>Origin</label>
      <div class="value">${manifest.origin}</div>
    </div>
  </div>

  <div class="route-info">
    <label>Route:</label>
    ${routeHTML}
  </div>

  ${warningsHTML}

  <div class="section">
    <h2>PASSENGERS (${manifest.passengers.length})</h2>
    ${passengersHTML}
  </div>

  <div class="section">
    <h2>FREIGHT (${manifest.freight.length} items)</h2>
    ${freightHTML}
  </div>

  <div class="section">
    <h2>MAIL (${manifest.mail.length} bags)</h2>
    ${mailHTML}
  </div>

  <div class="totals-grid">
    <div class="total-box">
      <label>Passengers + Bags</label>
      <div class="value">${formatWeight(manifest.totals.passengerWeightKg + manifest.totals.baggageWeightKg)} kg</div>
    </div>
    <div class="total-box">
      <label>Freight</label>
      <div class="value">${formatWeight(manifest.totals.freightWeightKg)} kg</div>
    </div>
    <div class="total-box">
      <label>Mail</label>
      <div class="value">${formatWeight(manifest.totals.mailWeightKg)} kg</div>
    </div>
  </div>

  <div class="wb-section">
    <div class="wb-summary ${manifest.wAndB.withinEnvelope ? '' : 'invalid'}">
      <h3>WEIGHT & BALANCE</h3>
      <div class="wb-item">
        <label>Total Weight:</label>
        <span class="value">${formatWeight(manifest.wAndB.totalWeightKg)} kg</span>
      </div>
      <div class="wb-item">
        <label>MTOW:</label>
        <span class="value">${formatWeight(manifest.wAndB.mtow)} kg</span>
      </div>
      <div class="wb-item">
        <label>Weight Margin:</label>
        <span class="value">${formatWeight(manifest.wAndB.mtow - manifest.wAndB.totalWeightKg)} kg</span>
      </div>
      <div class="wb-item">
        <label>Status:</label>
        <span class="status-badge ${manifest.wAndB.withinEnvelope ? 'status-ok' : 'status-error'}">
          ${manifest.wAndB.withinEnvelope ? 'WITHIN LIMITS' : 'OUT OF LIMITS'}
        </span>
      </div>
    </div>
    <div class="wb-summary ${manifest.wAndB.withinEnvelope ? '' : 'invalid'}">
      <h3>CENTER OF GRAVITY</h3>
      <div class="wb-item">
        <label>CG:</label>
        <span class="value">${formatCG(manifest.wAndB.cg)}</span>
      </div>
      <div class="wb-item">
        <label>Forward Limit:</label>
        <span class="value">${formatCG(manifest.wAndB.cgMin)}</span>
      </div>
      <div class="wb-item">
        <label>Aft Limit:</label>
        <span class="value">${formatCG(manifest.wAndB.cgMax)}</span>
      </div>
    </div>
  </div>

  <div class="signature-section">
    <div class="signature-box">
      <label>Operations Approval</label>
      <div class="signature-line"></div>
      <div style="margin-top: 5px; font-size: 9px;">Name / Date / Time</div>
    </div>
    <div class="signature-box">
      <label>Pilot Signature</label>
      <div class="signature-line"></div>
      <div style="margin-top: 5px; font-size: 9px;">Name / Date / Time</div>
    </div>
  </div>

  <div class="footer">
    <div>Manifest ID: ${manifest.manifestId}</div>
    <div>Generated by: ${manifest.generatedBy}</div>
    <div>Version: ${manifest.version}</div>
  </div>
</body>
</html>
`;
}

/**
 * Generate PDF from manifest data
 */
export async function generateManifestPDF(manifest: ManifestJSON, manifestId: number): Promise<string> {
  await ensureStorageDir();

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    const html = generateManifestHTML(manifest);

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const filename = `${manifest.manifestId}-v${manifest.version}.pdf`;
    const filepath = path.join(PDF_STORAGE_PATH, filename);

    await page.pdf({
      path: filepath,
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm',
      },
    });

    // Update manifest record with PDF path
    await prisma.manifest.update({
      where: { id: manifestId },
      data: { pdfPath: `/storage/manifests/${filename}` },
    });

    return filename;
  } finally {
    await browser.close();
  }
}

export default { generateManifestPDF };
