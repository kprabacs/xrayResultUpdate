import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function POST(request: Request) {
  console.log("Evaluate report API called.");
  const tempFiles: string[] = [];

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.error("No file found in form data.");
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    console.log(`Received file: ${file.name}`);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cucumber-'));
    tempFiles.push(tempDir);
    const tempFilePath = path.join(tempDir, file.name);
    await fs.writeFile(tempFilePath, Buffer.from(await file.arrayBuffer()));
    console.log(`File saved to temporary path: ${tempFilePath}`);

    const pythonExecutable = path.resolve(process.cwd(), 'venv', 'bin', 'python');
    const scriptPath = path.resolve(process.cwd(), 'evaluate_report.py');

    const pythonResult = await new Promise<string>((resolve, reject) => {
      console.log(`Spawning python script: ${pythonExecutable} ${scriptPath}`);
      const pythonProcess = spawn(pythonExecutable, [scriptPath, tempFilePath]);
      
      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        console.log(`Python script exited with code ${code}`);
        if (stderr) {
            console.error('Python stderr:', stderr);
        }
        if (code !== 0) {
          return reject(new Error(`Python script failed with code ${code}: ${stderr || 'No stderr output.'}`));
        }
        console.log('Python stdout:', stdout);
        resolve(stdout);
      });

      pythonProcess.on('error', (err) => {
          console.error('Failed to start python process:', err);
          reject(new Error(`Failed to start python process: ${err.message}`));
      });
    });

    if (!pythonResult.trim()) {
        console.error("Python script produced no output.");
        throw new Error("Evaluation script produced no output. The report might be empty or invalid.");
    }

    let result;
    try {
        result = JSON.parse(pythonResult);
        console.log("Successfully parsed python script output.");
    } catch (e) {
        console.error("Failed to parse python script output as JSON:", pythonResult);
        throw new Error("Evaluation script returned invalid data.");
    }

    if (result.status === 'issues_found' && result.file_path) {
      console.log("Issues found, reading generated Excel report.");
      const buffer = await fs.readFile(result.file_path);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Disposition': `attachment; filename="evaluation_report.xlsx"`,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });
    } else {
      console.log("No issues found or no file generated, returning JSON response.");
      return NextResponse.json(result);
    }

  } catch (error) {
    console.error('Error in /api/evaluate-report:', error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    console.log("Cleaning up temporary files:", tempFiles);
    for (const file of tempFiles) {
        try {
            await fs.rm(file, { recursive: true, force: true });
        } catch (e) {
            console.error(`Failed to clean up temporary file/dir: ${file}`, e);
        }
    }
  }
}
