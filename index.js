// server.js - Certificate Platform Backend
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const { createCanvas } = require('canvas');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

// ==================== ENVIRONMENT VARIABLES VALIDATION ====================

const requiredEnvVars = [
  'MONGODB_URI',
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'FRONTEND_URL'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n💡 Please create a .env file with all required variables.');
  console.error('   See .env.example for reference.\n');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(cors());

// ==================== DATABASE SETUP ====================

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Certificate Schema
const certificateSchema = new mongoose.Schema({
  certificateId: { 
    type: String, 
    unique: true, 
    required: true,
    index: true 
  },
  studentName: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true 
  },
  programName: { 
    type: String,
    default: 'General Program'
  },
  dateOfIssue: { 
    type: Date, 
    default: Date.now 
  },
  certificateImageUrl: { 
    type: String,
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const Certificate = mongoose.model('Certificate', certificateSchema);

// ==================== SUPABASE SETUP ====================

// Validate Supabase URL format
const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
  console.error('❌ Invalid SUPABASE_URL. It must start with https://');
  console.error(`   Current value: ${supabaseUrl}`);
  process.exit(1);
}

// Use service role key for backend operations (bypasses RLS)
// If not available, fall back to anon key (requires RLS policies)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // Validate that service role key is different from anon key
  if (process.env.SUPABASE_SERVICE_ROLE_KEY === process.env.SUPABASE_KEY) {
    console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is the same as SUPABASE_KEY (anon key)');
    console.error('   The service role key must be different from the anon key.');
    console.error('\n📋 How to get the correct Service Role Key:');
    console.error('   1. Go to https://app.supabase.com');
    console.error('   2. Select your project');
    console.error('   3. Go to Settings → API');
    console.error('   4. Find the "service_role" key (it will be different from "anon public" key)');
    console.error('   5. Copy the service_role key');
    console.error('   6. Update SUPABASE_SERVICE_ROLE_KEY in your .env file');
    console.error('   7. Restart your server\n');
    process.exit(1);
  }
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

// ==================== NODEMAILER SETUP ====================

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// ==================== CERTIFICATE GENERATION ====================

async function generateCertificate(studentName, certificateId, programName, dateOfIssue) {
  try {
    const width = 1200;
    const height = 800;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background - Beige/Cream color
    ctx.fillStyle = '#faf8f3';
    ctx.fillRect(0, 0, width, height);

    // Outer decorative border
    ctx.strokeStyle = '#8b6f47';
    ctx.lineWidth = 8;
    ctx.strokeRect(15, 15, width - 30, height - 30);

    // Inner decorative border
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    // Title - Certificate of Completion
    ctx.font = 'bold 56px Georgia';
    ctx.fillStyle = '#5d4037';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Certificate of Completion', width / 2, 100);

    // Subtitle line
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(250, 180);
    ctx.lineTo(width - 250, 180);
    ctx.stroke();

    // "This is to certify that" text
    ctx.font = '18px Georgia';
    ctx.fillStyle = '#6d4c41';
    ctx.fillText('This is to certify that', width / 2, 220);

    // Student Name - Bold and Large
    ctx.font = 'bold 52px Georgia';
    ctx.fillStyle = '#000000';
    ctx.fillText(studentName, width / 2, 310);

    // Underline for name
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 280, 385);
    ctx.lineTo(width / 2 + 280, 385);
    ctx.stroke();

    // "has successfully completed" text
    ctx.font = '18px Georgia';
    ctx.fillStyle = '#6d4c41';
    ctx.fillText('has successfully completed the', width / 2, 430);

    // Program Name
    ctx.font = 'bold 22px Georgia';
    ctx.fillStyle = '#5d4037';
    ctx.fillText(programName, width / 2, 470);

    // "program" text
    ctx.font = '18px Georgia';
    ctx.fillStyle = '#6d4c41';
    ctx.fillText('program', width / 2, 510);

    // Certificate ID at bottom left
    ctx.font = '12px Arial';
    ctx.fillStyle = '#999999';
    ctx.textAlign = 'left';
    ctx.fillText(`Certificate ID: ${certificateId}`, 60, height - 50);

    // Date at bottom right
    const formattedDate = dateOfIssue.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    ctx.textAlign = 'right';
    ctx.fillText(`Date: ${formattedDate}`, width - 60, height - 50);

    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('Error generating certificate:', error);
    throw error;
  }
}

// ==================== UPLOAD TO SUPABASE ====================

async function uploadToSupabase(buffer, certificateId) {
  try {
    const fileName = `Mediseek/${certificateId}.png`;
    
    // Upload file to Supabase storage
    const { data, error } = await supabase.storage
      .from('Mediseek')
      .upload(fileName, buffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) {
      // Check if it's a network/DNS error
      if (error.message && error.message.includes('ENOTFOUND')) {
        throw new Error(`DNS resolution failed. Cannot reach Supabase at ${process.env.SUPABASE_URL}. Please verify:\n   1. The Supabase project exists and is active\n   2. The URL is correct (check Supabase dashboard)\n   3. Your internet connection is working`);
      }
      
      // Check if it's an RLS policy error
      if (error.message && (error.message.includes('row-level security policy') || error.statusCode === '403')) {
        const errorMsg = `Row Level Security (RLS) Policy Error. Even though your bucket is set to "public", you still need RLS policies for UPLOADS (INSERT operations). Add SUPABASE_SERVICE_ROLE_KEY to your .env file or configure RLS policies in Supabase Dashboard.`;
        throw new Error(errorMsg);
      }
      
      throw new Error(`Failed to upload certificate: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('Mediseek')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading to Supabase:', error.message);
    throw error;
  }
}



async function sendCertificateEmail(email, studentName, certificateId) {
  try {
    const verificationUrl = `https://upgradtask-frontend.vercel.app/certificate/${certificateId}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '🎓 Your Certificate has been Generated!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5d4037;">Congratulations, ${studentName}!</h2>
          <p style="font-size: 16px; color: #333;">Your certificate has been successfully generated.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="margin: 0; color: #666; font-size: 14px; margin-bottom: 10px;">Click below to view your certificate:</p>
            <a href="${verificationUrl}" style="background-color: #8b6f47; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px; font-weight: bold;">View My Certificate</a>
          </div>

          <p style="font-size: 14px; color: #666; margin-top: 20px;">Or copy this link:</p>
          <p style="background-color: #f9f9f9; padding: 10px; border-radius: 4px; word-break: break-all; color: #666; font-size: 12px;">
            ${verificationUrl}
          </p>
          
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px;">
            Best regards,<br>
            Certificate Platform Team
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}


function validateCsvRow(row) {
  const studentName = row['Name'] || row['name'] || row['Student Name'] || row['student_name'];
  const email = row['Email'] || row['email'];
  const programName = row['Program'] || row['program'] || 'General Program';

  if (!studentName || !email) {
    return {
      valid: false,
      error: 'Missing required fields: Name and Email'
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: `Invalid email format: ${email}`
    };
  }

  return {
    valid: true,
    data: {
      studentName: studentName.trim(),
      email: email.trim().toLowerCase(),
      programName: programName.trim()
    }
  };
}

// ==================== API ENDPOINTS ====================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// ==================== ADMIN: BULK UPLOAD CSV ====================

app.post('/api/admin/upload-csv', multer({ storage: multer.memoryStorage() }).single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }

    if (!req.file.originalname.endsWith('.csv')) {
      return res.status(400).json({ 
        success: false,
        error: 'File must be a CSV file' 
      });
    }

    const results = [];
    const errors = [];
    const stream = require('stream');
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    // Parse CSV
    bufferStream
      .pipe(csv())
      .on('data', (row) => {
        const validation = validateCsvRow(row);
        if (validation.valid) {
          results.push(validation.data);
        } else {
          errors.push({
            row: row,
            error: validation.error
          });
        }
      })
      .on('end', async () => {
        if (results.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No valid records found in CSV',
            validationErrors: errors
          });
        }

        const processedCertificates = [];
        const failedCertificates = [];

        for (const student of results) {
          try {
            const certificateId = `cert_${uuidv4()}`;
            const dateOfIssue = new Date();

            // Generate certificate image
            const imageBuffer = await generateCertificate(
              student.studentName,
              certificateId,
              student.programName,
              dateOfIssue
            );

            // Upload to Supabase
            const certificateImageUrl = await uploadToSupabase(imageBuffer, certificateId);

            // Save to MongoDB
            const certificate = new Certificate({
              certificateId,
              studentName: student.studentName,
              email: student.email,
              programName: student.programName,
              certificateImageUrl,
              dateOfIssue
            });

            await certificate.save();

            // Send email
            await sendCertificateEmail(student.email, student.studentName, certificateId);

            processedCertificates.push({
              studentName: student.studentName,
              email: student.email,
              certificateId,
              status: 'Success',
              certificateImageUrl
            });
          } catch (error) {
            console.error(`Error processing ${student.studentName}:`, error.message);
            failedCertificates.push({
              studentName: student.studentName,
              email: student.email,
              status: 'Failed',
              error: error.message
            });
          }
        }

        res.status(200).json({
          success: true,
          message: 'CSV processing completed',
          summary: {
            totalRecords: results.length,
            successfullyProcessed: processedCertificates.length,
            failed: failedCertificates.length
          },
          processed: processedCertificates,
          failed: failedCertificates,
          csvValidationErrors: errors
        });
      })
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        res.status(400).json({
          success: false,
          error: `CSV parsing failed: ${error.message}`
        });
      });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ==================== PUBLIC: GET CERTIFICATE BY ID ====================

app.get('/api/certificate/:certificateId', async (req, res) => {
  try {
    const { certificateId } = req.params;

    if (!certificateId) {
      return res.status(400).json({
        success: false,
        error: 'Certificate ID is required'
      });
    }

    const certificate = await Certificate.findOne({ certificateId });

    if (!certificate) {
      return res.status(404).json({
        success: false,
        error: 'Certificate not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        certificateId: certificate.certificateId,
        studentName: certificate.studentName,
        email: certificate.email,
        programName: certificate.programName,
        dateOfIssue: certificate.dateOfIssue,
        certificateImageUrl: certificate.certificateImageUrl
      }
    });
  } catch (error) {
    console.error('Error fetching certificate:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== ADMIN: GET ALL CERTIFICATES ====================

app.get('/api/admin/certificates', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Certificate.countDocuments();
    const certificates = await Certificate.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: certificates,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== ADMIN: GET STATISTICS ====================

app.get('/api/admin/stats', async (req, res) => {
  try {
    const total = await Certificate.countDocuments();
    const recent = await Certificate.find()
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.status(200).json({
      success: true,
      data: {
        totalCertificates: total,
        recentCertificates: recent
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== ADMIN: SEARCH CERTIFICATES ====================

app.get('/api/admin/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const certificates = await Certificate.find({
      $or: [
        { studentName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { certificateId: { $regex: query, $options: 'i' } }
      ]
    }).limit(20);

    res.status(200).json({
      success: true,
      data: certificates,
      count: certificates.length
    });
  } catch (error) {
    console.error('Error searching certificates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// ==================== SERVER START ====================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});