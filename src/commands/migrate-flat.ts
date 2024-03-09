import { command, string, positional } from 'cmd-ts';
import { isEmptyDir } from '../fs/is-empty-dir';
import {
  skipCorrectionsArg,
  errorDirArg,
  forceArg,
  timeoutArg,
  verboseArg,
} from './common';
import { migrateDirFlatGen } from '../dir/migrate-flat';
import { ExifTool } from 'exiftool-vendored';
import { MediaMigrationError } from '../media/MediaMigrationError';
import { pathExists } from 'fs-extra';

export const migrateFlat = command({
  name: 'google-photos-migrate-flat',
  args: {
    inputDir: positional({
      type: string,
      displayName: 'input_dir',
      description: 'The path to your "Google Photos" directory.',
    }),
    outputDir: positional({
      type: string,
      displayName: 'output_dir',
      description: 'The path to your flat output directory.',
    }),
    errorDir: errorDirArg,
    force: forceArg,
    timeout: timeoutArg,
    skipCorrections: skipCorrectionsArg,
    verbose: verboseArg,
  },
  handler: async ({
    inputDir,
    outputDir,
    errorDir,
    force,
    timeout,
    verbose,
  }) => {
    const errs: string[] = [];
    const checkErrs = () => {
      if (errs.length !== 0) {
        errs.forEach((e) => console.error(e));
        process.exit(1);
      }
    };

    if (!(await pathExists(inputDir))) {
      errs.push(`The specified google directory does not exist: ${inputDir}`);
    }
    if (!(await pathExists(outputDir))) {
      errs.push(`The specified output directory does not exist: ${outputDir}`);
    }
    if (!(await pathExists(errorDir))) {
      errs.push(`The specified error directory does not exist: ${errorDir}`);
    }
    checkErrs();

    if (!force && !(await isEmptyDir(outputDir))) {
      errs.push(
        'The output directory is not empty. Pass "-f" to force the operation.'
      );
    }
    if (!force && !(await isEmptyDir(errorDir))) {
      errs.push(
        'The error directory is not empty. Pass "-f" to force the operation.'
      );
    }
    if (await isEmptyDir(inputDir)) {
      errs.push(`Nothing to do, the source directory is empty: ${inputDir}`);
    }
    checkErrs();

    console.log('Started migration.');
    const migGen = migrateDirFlatGen({
      inputDir,
      outputDir,
      errorDir,
      log: console.log,
      warnLog: console.error,
      verboseLog: verbose ? console.log : undefined,
      exiftool: new ExifTool({ taskTimeoutMillis: timeout }),
      endExifTool: true,
    });
    const counts = { err: 0, suc: 0 };
    for await (const result of migGen) {
      if (result instanceof MediaMigrationError) {
        console.error(`Error: ${result}`);
        counts.err++;
        continue;
      } else {
        counts.suc++;
      }
    }

    console.log(`Done! Processed ${counts.suc + counts.err} files.`);
    console.log(`Files migrated: ${counts.suc}`);
    console.log(`Files failed: ${counts.err}`);
  },
});
