import { drawLearningTree } from './drawing.ts';
import { defaultWorksheetPrompts, prepareWorksheet, worksheetHTML, worksheetPackage } from './worksheet.ts';
import type { PreparedWorksheet, WorksheetAudience, WorksheetCapture, WorksheetOptions } from './worksheet.ts';
import type { BuildInfo } from '../provenance/identity.ts';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const field = (id: string) => $<HTMLInputElement>(id);
export type WorksheetChoices = { current: WorksheetCapture | null; kept?: WorksheetCapture; title: string; instructions: string; teacherNotes: string };

/** Explicit worksheet downloads only; the controller has no editor/history/project mutation API. */
export class WorksheetController {
  private choices: WorksheetChoices | null = null;
  private prepared: PreparedWorksheet | null = null;
  private sequence = 0;
  private build: BuildInfo | null = null;
  constructor() {
    $('worksheet-close').onclick = () => this.close();
    $('worksheet-dialog').addEventListener('close', () => { if (!$<HTMLDialogElement>('worksheet-dialog').open) this.reset(); });
    for (const id of ['worksheet-title', 'worksheet-instructions', 'worksheet-notes', 'worksheet-paper', 'worksheet-lines', 'worksheet-codes', 'worksheet-data']) $(id).addEventListener('input', () => this.invalidate());
    $('worksheet-scope').onchange = () => this.prompts();
    $('worksheet-audience').onchange = () => this.preview();
    $('worksheet-prepare').onclick = () => void this.prepare();
    $('worksheet-student').onclick = () => void this.download('student');
    $('worksheet-teacher').onclick = () => void this.download('teacher');
  }
  open(choices: WorksheetChoices, build: BuildInfo | null): void {
    if (!choices.current && !choices.kept) throw new Error('Choose a valid question or keep a valid question setup first.');
    this.choices = structuredClone(choices); this.build = build ? { ...build } : null;
    field('worksheet-title').value = choices.title; field('worksheet-instructions').value = choices.instructions; field('worksheet-notes').value = choices.teacherNotes;
    field('worksheet-codes').checked = true; field('worksheet-data').checked = true; field('worksheet-lines').value = '3'; field('worksheet-paper').value = 'A4'; field('worksheet-audience').value = 'student';
    const scope = $<HTMLSelectElement>('worksheet-scope'); scope.options[0].disabled = !choices.current; scope.options[1].disabled = !choices.kept; scope.value = choices.current ? 'current' : 'kept';
    $('worksheet-scope-row').hidden = (choices.current ?? choices.kept)!.kind !== 'tree';
    $('worksheet-codes-row').hidden = (choices.current ?? choices.kept)!.kind !== 'tree';
    $('worksheet-data-row').hidden = (choices.current ?? choices.kept)!.kind === 'tree';
    this.prompts(); $<HTMLDialogElement>('worksheet-dialog').showModal();
  }
  close(): void { $<HTMLDialogElement>('worksheet-dialog').close(); this.reset(); }
  private reset(): void {
    this.sequence++; this.choices = null; this.prepared = null; this.build = null; $('worksheet-preview').setAttribute('srcdoc', '');
    for (const id of ['worksheet-title', 'worksheet-instructions', 'worksheet-notes']) field(id).value = '';
    $('worksheet-prompts').replaceChildren();
  }
  private invalidate(): void {
    this.sequence++; this.prepared = null; $('worksheet-error').textContent = ''; $('worksheet-status').textContent = 'Prepare a preview after editing. No worksheet has been downloaded.';
    $<HTMLButtonElement>('worksheet-prepare').disabled = false;
    for (const id of ['worksheet-student', 'worksheet-teacher']) $<HTMLButtonElement>(id).disabled = true;
    $('worksheet-preview').setAttribute('srcdoc', '');
  }
  private capture(): WorksheetCapture {
    const value = field('worksheet-scope').value === 'kept' ? this.choices?.kept : this.choices?.current;
    if (!value) throw new Error('No valid setup in this worksheet scope.'); return value;
  }
  private prompts(): void {
    this.invalidate(); const holder = $('worksheet-prompts'); holder.replaceChildren();
    for (const [i, prompt] of defaultWorksheetPrompts(this.capture()).entries()) {
      const label = document.createElement('label'), span = document.createElement('span'), area = document.createElement('textarea');
      span.textContent = `Question ${i + 1}`; area.value = prompt; area.maxLength = 5000; area.rows = 3; area.className = 'full-input'; area.oninput = () => this.invalidate(); label.append(span, area); holder.append(label);
    }
  }
  private options(): WorksheetOptions {
    return { title: field('worksheet-title').value, instructions: field('worksheet-instructions').value, teacherNotes: field('worksheet-notes').value, paper: field('worksheet-paper').value as WorksheetOptions['paper'], answerLines: Number(field('worksheet-lines').value), tipCodes: field('worksheet-codes').checked, includeData: field('worksheet-data').checked, prompts: [...$('worksheet-prompts').querySelectorAll('textarea')].map(area => area.value) };
  }
  private async prepare(): Promise<void> {
    const request = ++this.sequence; $<HTMLButtonElement>('worksheet-prepare').disabled = true; $('worksheet-error').textContent = ''; $('worksheet-status').textContent = 'Preparing static figures, source/model references and font/geometry findings…';
    try {
      const prepared = await prepareWorksheet(this.capture(), this.options(), this.build, drawLearningTree);
      if (request !== this.sequence || !this.choices) return;
      this.prepared = prepared; this.preview();
      for (const id of ['worksheet-student', 'worksheet-teacher']) $<HTMLButtonElement>(id).disabled = false;
      $('worksheet-status').textContent = 'Preview ready. Review both audiences and any draft findings. Student and teacher ZIPs are separate; no learner responses or progress are included.';
    } catch (error) { if (request === this.sequence) { $('worksheet-error').textContent = error instanceof Error ? error.message : String(error); $('worksheet-status').textContent = 'No worksheet downloaded. Correct the setup or print options, then prepare again.'; } }
    finally { if (request === this.sequence) $<HTMLButtonElement>('worksheet-prepare').disabled = false; }
  }
  private preview(): void {
    if (!this.prepared) return;
    // Create inside the open dialog: a sandboxed frame initialized while hidden can retain a blank layout.
    const previous = $<HTMLIFrameElement>('worksheet-preview'), frame = previous.cloneNode(false) as HTMLIFrameElement;
    frame.srcdoc = worksheetHTML(this.prepared, field('worksheet-audience').value as WorksheetAudience); previous.replaceWith(frame);
  }
  private async download(audience: WorksheetAudience): Promise<void> {
    if (!this.prepared) return;
    const request = this.sequence, prepared = this.prepared;
    try {
      const output = await worksheetPackage(prepared, audience);
      if (request !== this.sequence || this.prepared !== prepared || !this.choices) return;
      const url = URL.createObjectURL(new Blob([new Uint8Array(output.zip)], { type: 'application/zip' })), link = document.createElement('a');
      link.href = url; link.download = `phyloink-worksheet-${prepared.kind}-${audience}.zip`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      $('worksheet-status').textContent = `${audience === 'student' ? 'Student' : 'Teacher'} ZIP downloaded. Open its HTML locally and use Print / Save as PDF. ${audience === 'teacher' ? 'Keep teacher references and educator notes separate from student distribution.' : 'The student package has no answer key or educator notes.'}`;
    } catch (error) { if (request === this.sequence) $('worksheet-error').textContent = error instanceof Error ? error.message : String(error); }
  }
}
