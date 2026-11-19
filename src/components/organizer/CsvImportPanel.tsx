import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  XCircle,
} from 'lucide-react';
import type { SchoolConfig } from '../../config/school';
import { createClub } from '../../services/clubService';
import { createManagedEvent } from '../../services/eventService';
import type { Club } from '../../types/club';
import type { SchoolEvent } from '../../types/event';
import {
  CLUBS_CSV_TEMPLATE,
  downloadCsvTemplate,
  EVENTS_CSV_TEMPLATE,
  validateClubCsvImport,
  validateEventCsvImport,
} from '../../utils/csvImport';
import { toUserFriendlyErrorMessage } from '../../utils/errorHandling';

interface CsvImportPanelProps {
  schoolConfig: SchoolConfig;
  currentAdminUid: string;
  existingClubs: Club[];
  existingEvents: SchoolEvent[];
  onShowToast: (type: 'error' | 'success', message: string) => void;
}

type ImportMode = 'events' | 'clubs';

export function CsvImportPanel({
  schoolConfig,
  currentAdminUid,
  existingClubs,
  existingEvents,
  onShowToast,
}: CsvImportPanelProps) {
  const [mode, setMode] = useState<ImportMode>('events');
  const [csvText, setCsvText] = useState('');
  const [eventTargetStatus, setEventTargetStatus] = useState<'draft' | 'published'>('draft');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    mode: ImportMode;
    imported: number;
    skipped: number;
    failed: number;
  } | null>(null);

  const eventSummary = useMemo(() => {
    if (mode !== 'events' || !csvText.trim()) return null;
    return validateEventCsvImport({
      csvText,
      existingClubs,
      existingEvents,
      schoolTimezone: schoolConfig.timezone,
    });
  }, [csvText, existingClubs, existingEvents, mode, schoolConfig.timezone]);

  const clubSummary = useMemo(() => {
    if (mode !== 'clubs' || !csvText.trim()) return null;
    return validateClubCsvImport({
      csvText,
      existingClubs,
    });
  }, [csvText, existingClubs, mode]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      onShowToast('error', 'CSV file is larger than 1 MB. Split into smaller batches.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(typeof reader.result === 'string' ? reader.result : '');
      setConfirmChecked(false);
      setLastResult(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!confirmChecked) return;
    setImporting(true);
    let imported = 0;
    let failed = 0;

    try {
      if (mode === 'events' && eventSummary) {
        const skipped = eventSummary.duplicateRows.length + eventSummary.errorRows.length;
        for (const row of eventSummary.validRows) {
          if (!row.values) continue;
          try {
            await createManagedEvent({
              values: row.values,
              status: eventTargetStatus,
              schoolId: schoolConfig.id,
              timezone: row.timezone || schoolConfig.timezone,
              creatorUid: currentAdminUid,
            });
            imported++;
          } catch {
            failed++;
          }
        }
        setLastResult({ mode: 'events', imported, skipped, failed });
        onShowToast(
          failed > 0 && imported === 0 ? 'error' : 'success',
          `Imported ${imported} event${imported === 1 ? '' : 's'} (${skipped} skipped, ${failed} failed).`
        );
      } else if (mode === 'clubs' && clubSummary) {
        const skipped = clubSummary.duplicateRows.length + clubSummary.errorRows.length;
        for (const row of clubSummary.validRows) {
          if (!row.values) continue;
          try {
            await createClub({
              schoolId: schoolConfig.id,
              values: row.values,
              adminUid: currentAdminUid,
            });
            imported++;
          } catch {
            failed++;
          }
        }
        setLastResult({ mode: 'clubs', imported, skipped, failed });
        onShowToast(
          failed > 0 && imported === 0 ? 'error' : 'success',
          `Imported ${imported} club${imported === 1 ? '' : 's'} (${skipped} skipped, ${failed} failed).`
        );
      }

      if (imported > 0) {
        setCsvText('');
        setConfirmChecked(false);
      }
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'CSV import encountered an error.'));
    } finally {
      setImporting(false);
    }
  };

  const activeValidCount =
    mode === 'events' ? (eventSummary?.validRows.length ?? 0) : (clubSummary?.validRows.length ?? 0);
  const activeDuplicateCount =
    mode === 'events'
      ? (eventSummary?.duplicateRows.length ?? 0)
      : (clubSummary?.duplicateRows.length ?? 0);
  const activeErrorCount =
    mode === 'events' ? (eventSummary?.errorRows.length ?? 0) : (clubSummary?.errorRows.length ?? 0);

  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-[#171717] flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
            <span>Controlled CSV Campus Data Import</span>
          </h2>
          <p className="mt-0.5 text-xs text-[#737373]">
            Import genuine school clubs first, then campus events. Existing records are never overwritten, invalid rows are rejected before import, and organizer roles are never auto-assigned during club import.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-1 self-start shrink-0">
          <button
            type="button"
            onClick={() => {
              setMode('clubs');
              setCsvText('');
              setConfirmChecked(false);
              setLastResult(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'clubs' ? 'bg-white text-[#171717] shadow-xs' : 'text-[#737373] hover:text-[#171717]'
            }`}
          >
            Clubs CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('events');
              setCsvText('');
              setConfirmChecked(false);
              setLastResult(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'events' ? 'bg-white text-[#171717] shadow-xs' : 'text-[#737373] hover:text-[#171717]'
            }`}
          >
            Events CSV
          </button>
        </div>
      </div>

      {/* Upload & Template Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#171717] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#333333] cursor-pointer">
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Upload {mode === 'events' ? 'Events' : 'Clubs'} CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>

          <button
            type="button"
            onClick={() =>
              downloadCsvTemplate(
                mode === 'events' ? 'oneplace-events-template.csv' : 'oneplace-clubs-template.csv',
                mode === 'events' ? EVENTS_CSV_TEMPLATE : CLUBS_CSV_TEMPLATE
              )
            }
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F3F4F6] cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-[#E85D04]" aria-hidden="true" />
            <span>Download CSV Template</span>
          </button>
        </div>

        {mode === 'events' && (
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="csv-event-status" className="font-medium text-[#525252]">
              Import events as:
            </label>
            <select
              id="csv-event-status"
              value={eventTargetStatus}
              onChange={(e) => setEventTargetStatus(e.target.value as 'draft' | 'published')}
              className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs font-semibold text-[#171717] focus:border-[#E85D04] focus:outline-none"
            >
              <option value="draft">Draft (review before publishing)</option>
              <option value="published">Published immediately</option>
            </select>
          </div>
        )}
      </div>

      {/* Paste CSV Fallback */}
      <div>
        <label htmlFor="csv-paste-input" className="block text-xs font-semibold text-[#171717] mb-1.5">
          Or paste CSV rows directly
        </label>
        <textarea
          id="csv-paste-input"
          rows={4}
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            setConfirmChecked(false);
            setLastResult(null);
          }}
          placeholder={
            mode === 'events'
              ? 'title,description,clubName,clubId,category,date,startTime,endTime,timezone,location,imageUrl,visibility'
              : 'name,shortDescription,description,category,visibility,meetingSchedule,meetingLocation,contactEmail,coverImageUrl,logoUrl,isOfficial'
          }
          className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 font-mono text-xs text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
        />
      </div>

      {/* Validation Preview */}
      {(eventSummary || clubSummary) && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5 text-center sm:text-left">
            <div>
              <p className="text-[11px] font-medium text-[#737373]">Valid &amp; Ready</p>
              <p className="font-mono tabular-nums text-lg font-bold text-[#16A34A]">
                {activeValidCount}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#737373]">Duplicates (Skipped)</p>
              <p className="font-mono tabular-nums text-lg font-bold text-[#D97706]">
                {activeDuplicateCount}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#737373]">Errors (Blocked)</p>
              <p className="font-mono tabular-nums text-lg font-bold text-[#DC2626]">
                {activeErrorCount}
              </p>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB]">
            {mode === 'events' &&
              eventSummary?.allRows.map((row) => (
                <div key={row.rowNumber} className="px-4 py-3 text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-[#171717]">
                      Row {row.rowNumber}: {row.rawTitle}{' '}
                      <span className="font-normal text-[#737373]">
                        · {row.rawClub} · {row.rawDate}
                      </span>
                    </p>
                    {row.status === 'valid' ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#16A34A]">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Valid
                      </span>
                    ) : row.status === 'duplicate' ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#D97706]">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        Duplicate
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#DC2626]">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Invalid
                      </span>
                    )}
                  </div>
                  {row.errors.map((err, i) => (
                    <p key={i} className="text-[#DC2626]">
                      • {err}
                    </p>
                  ))}
                  {row.warnings.map((warn, i) => (
                    <p key={i} className="text-[#B45309]">
                      • {warn}
                    </p>
                  ))}
                </div>
              ))}

            {mode === 'clubs' &&
              clubSummary?.allRows.map((row) => (
                <div key={row.rowNumber} className="px-4 py-3 text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-[#171717]">
                      Row {row.rowNumber}: {row.rawName}{' '}
                      <span className="font-normal text-[#737373]">· {row.rawCategory}</span>
                    </p>
                    {row.status === 'valid' ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#16A34A]">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Valid
                      </span>
                    ) : row.status === 'duplicate' ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#D97706]">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        Duplicate
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#DC2626]">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Invalid
                      </span>
                    )}
                  </div>
                  {row.errors.map((err, i) => (
                    <p key={i} className="text-[#DC2626]">
                      • {err}
                    </p>
                  ))}
                  {row.warnings.map((warn, i) => (
                    <p key={i} className="text-[#B45309]">
                      • {warn}
                    </p>
                  ))}
                </div>
              ))}
          </div>

          {activeValidCount > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#E85D04]/25 bg-[#E85D04]/5 p-4">
              <label className="inline-flex items-start gap-2 text-xs text-[#171717] cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[#E5E7EB] accent-[#E85D04]"
                />
                <span>
                  I confirm these{' '}
                  <strong className="font-mono tabular-nums">{activeValidCount}</strong> validated{' '}
                  {mode} belong to <strong>{schoolConfig.name}</strong> and are ready to import.
                </span>
              </label>

              <button
                type="button"
                disabled={!confirmChecked || importing}
                onClick={() => void handleConfirmImport()}
                className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-xl bg-[#E85D04] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] disabled:opacity-50 cursor-pointer"
              >
                {importing
                  ? 'Importing...'
                  : `Import ${activeValidCount} Valid ${mode === 'events' ? 'Event' : 'Club'}${activeValidCount === 1 ? '' : 's'}`}
              </button>
            </div>
          )}
        </div>
      )}

      {lastResult && (
        <div
          role="status"
          className="rounded-xl border border-[#16A34A]/25 bg-[#16A34A]/5 px-4 py-3 text-xs text-[#171717]"
        >
          Import finished ({lastResult.mode}):{' '}
          <strong className="font-mono text-[#16A34A]">{lastResult.imported}</strong> imported,{' '}
          <strong className="font-mono">{lastResult.skipped}</strong> skipped,{' '}
          <strong className="font-mono text-[#DC2626]">{lastResult.failed}</strong> failed.
        </div>
      )}
    </section>
  );
}
