import assert from 'node:assert';

import { Injectable, Logger } from '@nestjs/common';
import semver from 'semver';

import { Runtime, UnsupportedClientVersion } from '../../base';

@Injectable()
export class VersionService {
  private readonly logger = new Logger(VersionService.name);

  constructor(private readonly runtime: Runtime) {}

  private async getRecommendedVersion(versionRange: string) {
    try {
      const range = new semver.Range(versionRange);
      const versions = range.set
        .flat()
        .map(c => c.semver)
        .toSorted((a, b) => semver.rcompare(a, b));
      return versions[0]?.toString();
    } catch {
      return semver.valid(semver.coerce(versionRange));
    }
  }

  async checkVersion(clientVersion?: any) {
    const allowedVersion = await this.runtime.fetch('version/allowedVersion');
    const recommendedVersion = await this.getRecommendedVersion(allowedVersion);
    if (!allowedVersion || !recommendedVersion) {
      // ignore invalid allowed version config
      return true;
    }

    const parsedClientVersion = semver.valid(clientVersion);
    const action = semver.lt(parsedClientVersion || '0.0.0', recommendedVersion)
      ? 'upgrade'
      : 'downgrade';
    assert(
      typeof clientVersion === 'string' && clientVersion.length > 0,
      new UnsupportedClientVersion({
        clientVersion: '[Not Provided]',
        recommendedVersion,
        action,
      })
    );

    if (parsedClientVersion) {
      if (!semver.satisfies(parsedClientVersion, allowedVersion)) {
        throw new UnsupportedClientVersion({
          clientVersion,
          recommendedVersion,
          action,
        });
      }
      return true;
    } else {
      if (clientVersion) {
        this.logger.warn(`Invalid client version: ${clientVersion}`);
      }
      throw new UnsupportedClientVersion({
        clientVersion,
        recommendedVersion,
        action,
      });
    }
  }
}
