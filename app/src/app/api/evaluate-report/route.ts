import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function POST(request: Request) {
  const tempFiles: string[] = [];

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluate-'));
    tempFiles.push(tempDir);
    const tempFilePath = path.join(tempDir, file.name);
    
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempFilePath, fileBuffer);
    tempFiles.push(tempFilePath);

    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python');
    const scriptPath = path.join(process.cwd(), 'evaluate_report.py');

    const processPromise = new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
      const pythonProcess = spawn(venvPython, [scriptPath, tempFilePath]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        resolve({ stdout, stderr, code });
      });

      pythonProcess.on('error', (err) => {
        reject(err);
      });
    });

    const { stdout, stderr, code } = await processPromise;

    if (code !== 0) {
      console.error('Python script error:', stderr);
      throw new Error(`Script failed with code ${code}: ${stderr}`);
    }

    const result = JSON.parse(stdout);

    if (result.status === 'issues_found') {
      const excelPath = result.file_path;
      tempFiles.push(excelPath); 
      const excelBuffer = await fs.readFile(excelPath);
      const headers = new Headers();
      headers.append('Content-Disposition', `attachment; filename="evaluation_report.xlsx"`);
      headers.append('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return new NextResponse(excelBuffer, { headers });
    } else {
      return NextResponse.json(result);
    }

  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: `Backend error: ${errorMessage}` }, { status: 500 });
  } finally {
    // Cleanup
    for (const file of tempFiles) {
        try {
            await fs.rm(file, { recursive: true, force: true });
        } catch (e) {
            console.error(`Failed to clean up temporary file/dir: ${file}`, e);
        }
    }
  }
}
