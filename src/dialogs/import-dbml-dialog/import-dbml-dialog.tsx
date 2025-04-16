import React, {
    useCallback,
    useEffect,
    useState,
    Suspense,
    useRef,
} from 'react';
import * as monaco from 'monaco-editor';
import { useDialog } from '@/hooks/use-dialog';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogInternalContent,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Button } from '@/components/button/button';
import type { BaseImportDialogProps } from '../common/base-dialog-props';
import { useTranslation } from 'react-i18next';
import { Editor } from '@/components/code-snippet/code-snippet';
import { useTheme } from '@/hooks/use-theme';
import { AlertCircle } from 'lucide-react';
import { importDBMLToDiagram } from '@/lib/dbml-import';
import { useChartDB } from '@/hooks/use-chartdb';
import { Parser } from '@dbml/core';
import { useCanvas } from '@/hooks/use-canvas';
import { setupDBMLLanguage } from '@/components/code-snippet/languages/dbml-language';
import { useToast } from '@/components/toast/use-toast';
import { Spinner } from '@/components/spinner/spinner';
import { debounce } from '@/lib/utils';
import axios from 'axios';

interface DBMLError {
    message: string;
    line: number;
    column: number;
}

function parseDBMLError(error: unknown): DBMLError | null {
    try {
        if (typeof error === 'string') {
            const parsed = JSON.parse(error);
            if (parsed.diags?.[0]) {
                const diag = parsed.diags[0];
                return {
                    message: diag.message,
                    line: diag.location.start.line,
                    column: diag.location.start.column,
                };
            }
        } else if (error && typeof error === 'object' && 'diags' in error) {
            const parsed = error as {
                diags: Array<{
                    message: string;
                    location: { start: { line: number; column: number } };
                }>;
            };
            if (parsed.diags?.[0]) {
                return {
                    message: parsed.diags[0].message,
                    line: parsed.diags[0].location.start.line,
                    column: parsed.diags[0].location.start.column,
                };
            }
        }
    } catch (e) {
        console.error('Error parsing DBML error:', e);
    }
    return null;
}

export interface ImportDBMLDialogProps extends BaseImportDialogProps {
    withCreateEmptyDiagram?: boolean;
}

export const ImportDBMLDialog: React.FC<ImportDBMLDialogProps> = ({
    dialog,
    withCreateEmptyDiagram,
}) => {
    const [content, setContent] = useState('');
    const [projectID, setProjectID] = useState('');
    const [envID, setEnvID] = useState('');

    const fetDbmlFile = async () => {
        if (!!projectID && !!envID) {
            await axios
                .get(
                    `https://admin-api.ucode.run/v1/chart?project-id=${projectID}&environment-id=${envID}`
                )
                .then((res) => {
                    setContent(res?.data?.data?.dbml);
                    setDBMLContent(res?.data?.data?.dbml);
                });
        }
    };

    type ChartDataMessage = {
        type: 'UPDATE_DATA';
        payload: {
            projectID: string;
            envID: string;
        };
    };

    const handleMessage = useCallback(
        (event: MessageEvent) => {
            if (event.origin !== 'https://app.ucode.run') {
                return;
            }

            const data = event.data as ChartDataMessage;

            if (data.type === 'UPDATE_DATA') {
                setProjectID(data.payload.projectID);
                setEnvID(data.payload.envID);
            }
        },
        [setProjectID, setEnvID]
    );

    if (!content) {
        fetDbmlFile();
    }

    useEffect(() => {
        window.parent.postMessage({ type: 'READY' }, 'https://app.ucode.run');
        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const { t } = useTranslation();
    const initialDBML = content;

    const [dbmlContent, setDBMLContent] = useState<string>(initialDBML);

    const { closeImportDBMLDialog } = useDialog();
    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const { effectiveTheme } = useTheme();
    const { toast } = useToast();
    const {
        addTables,
        addRelationships,
        tables,
        relationships,
        removeTables,
        removeRelationships,
    } = useChartDB();
    const { reorderTables } = useCanvas();
    const [reorder, setReorder] = useState(false);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>();
    const decorationsCollection =
        useRef<monaco.editor.IEditorDecorationsCollection>();

    const handleEditorDidMount = (
        editor: monaco.editor.IStandaloneCodeEditor
    ) => {
        editorRef.current = editor;
        decorationsCollection.current = editor.createDecorationsCollection();
    };

    useEffect(() => {
        if (reorder) {
            reorderTables({
                updateHistory: false,
            });
            setReorder(false);
        }
    }, [reorder, reorderTables]);

    const highlightErrorLine = useCallback((error: DBMLError) => {
        if (!editorRef.current) return;

        const model = editorRef.current.getModel();
        if (!model) return;

        const decorations = [
            {
                range: new monaco.Range(
                    error.line,
                    1,
                    error.line,
                    model.getLineMaxColumn(error.line)
                ),
                options: {
                    isWholeLine: true,
                    className: 'dbml-error-line',
                    glyphMarginClassName: 'dbml-error-glyph',
                    hoverMessage: { value: error.message },
                    overviewRuler: {
                        color: '#ff0000',
                        position: monaco.editor.OverviewRulerLane.Right,
                        darkColor: '#ff0000',
                    },
                },
            },
        ];

        decorationsCollection.current?.set(decorations);
    }, []);

    const clearDecorations = useCallback(() => {
        decorationsCollection.current?.clear();
    }, []);

    const validateDBML = useCallback(
        async (content: string) => {
            // Clear previous errors
            setErrorMessage(undefined);
            clearDecorations();

            if (!content.trim()) return;

            try {
                const parser = new Parser();
                parser.parse(content, 'dbml');
            } catch (e) {
                const parsedError = parseDBMLError(e);
                if (parsedError) {
                    setErrorMessage(
                        t('import_dbml_dialog.error.description') +
                            ` (1 error found - in line ${parsedError.line})`
                    );
                    highlightErrorLine(parsedError);
                } else {
                    setErrorMessage(
                        e instanceof Error ? e.message : JSON.stringify(e)
                    );
                }
            }
        },
        [clearDecorations, highlightErrorLine, t]
    );

    const debouncedValidateRef = useRef<((value: string) => void) | null>(null);

    // Set up debounced validation
    useEffect(() => {
        debouncedValidateRef.current = debounce((value: string) => {
            validateDBML(value);
        }, 500);

        return () => {
            debouncedValidateRef.current = null;
        };
    }, [validateDBML]);

    // Trigger validation when content changes
    useEffect(() => {
        if (debouncedValidateRef.current) {
            debouncedValidateRef.current(dbmlContent);
        }
    }, [dbmlContent]);

    useEffect(() => {
        if (!dialog.open) {
            setErrorMessage(undefined);
            clearDecorations();
            setDBMLContent(initialDBML);
        }
    }, [dialog.open, initialDBML, clearDecorations]);

    const handleImport = useCallback(async () => {
        if (!dbmlContent.trim() || errorMessage) return;

        try {
            const importedDiagram = await importDBMLToDiagram(dbmlContent);
            const tableIdsToRemove = tables
                .filter((table) =>
                    importedDiagram.tables?.some(
                        (t) =>
                            t.name === table.name && t.schema === table.schema
                    )
                )
                .map((table) => table.id);
            // Find relationships that need to be removed
            const relationshipIdsToRemove = relationships
                .filter((relationship) => {
                    const sourceTable = tables.find(
                        (table) => table.id === relationship.sourceTableId
                    );
                    const targetTable = tables.find(
                        (table) => table.id === relationship.targetTableId
                    );
                    if (!sourceTable || !targetTable) return true;
                    const replacementSourceTable = importedDiagram.tables?.find(
                        (table) =>
                            table.name === sourceTable.name &&
                            table.schema === sourceTable.schema
                    );
                    const replacementTargetTable = importedDiagram.tables?.find(
                        (table) =>
                            table.name === targetTable.name &&
                            table.schema === targetTable.schema
                    );
                    return replacementSourceTable || replacementTargetTable;
                })
                .map((relationship) => relationship.id);

            // Remove existing items
            await Promise.all([
                removeTables(tableIdsToRemove, { updateHistory: false }),
                removeRelationships(relationshipIdsToRemove, {
                    updateHistory: false,
                }),
            ]);

            // Add new items
            await Promise.all([
                addTables(importedDiagram.tables ?? [], {
                    updateHistory: false,
                }),
                addRelationships(importedDiagram.relationships ?? [], {
                    updateHistory: false,
                }),
            ]);
            setReorder(true);
            closeImportDBMLDialog();
        } catch (e) {
            toast({
                title: t('import_dbml_dialog.error.title'),
                variant: 'destructive',
                description: (
                    <>
                        <div>{t('import_dbml_dialog.error.description')}</div>
                        {e instanceof Error ? e.message : JSON.stringify(e)}
                    </>
                ),
            });
        }
    }, [
        dbmlContent,
        closeImportDBMLDialog,
        tables,
        relationships,
        removeTables,
        removeRelationships,
        addTables,
        addRelationships,
        errorMessage,
        toast,
        setReorder,
        t,
    ]);

    return (
        <Dialog
            {...dialog}
            onOpenChange={(open) => {
                if (!open) {
                    closeImportDBMLDialog();
                }
            }}
        >
            <DialogContent
                className="flex h-[80vh] max-h-screen flex-col"
                showClose
            >
                <DialogHeader>
                    <DialogTitle>
                        {withCreateEmptyDiagram
                            ? t('import_dbml_dialog.example_title')
                            : t('import_dbml_dialog.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('import_dbml_dialog.description')}
                    </DialogDescription>
                </DialogHeader>
                <DialogInternalContent>
                    <Suspense fallback={<Spinner />}>
                        <Editor
                            value={dbmlContent}
                            onChange={(value) => setDBMLContent(value || '')}
                            language="dbml"
                            onMount={handleEditorDidMount}
                            theme={
                                effectiveTheme === 'dark'
                                    ? 'dbml-dark'
                                    : 'dbml-light'
                            }
                            beforeMount={setupDBMLLanguage}
                            options={{
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                glyphMargin: true,
                                lineNumbers: 'on',
                                scrollbar: {
                                    vertical: 'visible',
                                    horizontal: 'visible',
                                },
                            }}
                            className="size-full"
                        />
                    </Suspense>
                </DialogInternalContent>
                <DialogFooter>
                    <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-4">
                            <DialogClose asChild>
                                <Button variant="secondary">
                                    {withCreateEmptyDiagram
                                        ? t('import_dbml_dialog.skip_and_empty')
                                        : t('import_dbml_dialog.cancel')}
                                </Button>
                            </DialogClose>
                            {errorMessage ? (
                                <div className="flex items-center gap-1">
                                    <AlertCircle className="size-4 text-destructive" />

                                    <span className="text-xs text-destructive">
                                        {errorMessage ||
                                            t(
                                                'import_dbml_dialog.error.description'
                                            )}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                        <Button
                            onClick={handleImport}
                            disabled={!dbmlContent.trim() || !!errorMessage}
                        >
                            {withCreateEmptyDiagram
                                ? t('import_dbml_dialog.show_example')
                                : t('import_dbml_dialog.import')}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

//  project_id=27ab570d-1087-4ad8-b1a4-4a0425092a0f
// environment_id=d9b643ac-e253-432f-8be1-c91f174b8dd7

// Hasuari

// project_id=6fd296f6-9195-4ed3-af84-c1dcca929273
// environment_id=f6461617-c9b9-4bcb-bcaa-b6e443a6f755
