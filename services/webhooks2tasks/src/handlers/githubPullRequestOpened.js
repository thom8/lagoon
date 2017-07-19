// @flow

import { logger } from '@amazeeio/amazeeio-local-logging';

import { sendToAmazeeioLogs } from '@amazeeio/amazeeio-logs';

import { createDeployTask } from '@amazeeio/amazeeio-tasks';

import { getEnabledSystemsForSiteGroup } from '@amazeeio/amazeeio-api';

import type { WebhookRequestData, deployData, ChannelWrapper, SiteGroup  } from '../types';

export default async function githubPullRequestOpened(webhook: WebhookRequestData, siteGroup: SiteGroup, channelWrapper: ChannelWrapper) {

    const {
      webhooktype,
      event,
      giturl,
      uuid,
      body,
    } = webhook;

    const openshiftNamingPullRequests = (typeof siteGroup.openshift.naming !== 'undefined') ? siteGroup.openshift.naming.pullrequest : "${sitegroup}-pr-${number}"
    const openshiftRessourceAppName = openshiftNamingPullRequests.replace('${number}', body.number).replace('${sitegroup}', siteGroup.siteGroupName)

    const meta = {
      prNumber: body.number
    }

    const sha = body.pull_request.head.sha
    const branchName = body.pull_request.head.repo.default_branch


    const data: deployData = {
      siteGroupName: siteGroup.siteGroupName,
      type: 'pull_request',
      branchName: branchName,
      sha: sha
    }

    sendToAmazeeioLogs('info', siteGroup.siteGroupName, uuid, `${webhooktype}:${event}:opened:receive`, meta,
      `PR <${body.pull_request.html_url}|#${body.number} (${body.pull_request.title})> opened in <${body.repository.html_url}|${body.repository.full_name}>`
    )

    try {
      const taskResult = await createDeployTask(data);
      logger.verbose(taskResult)
      return;
    } catch (error) {
      switch (error.name) {
        case "SiteGroupNotFound":
        case "NoActiveSystemsDefined":
        case "UnknownActiveSystem":
        case "NoNeedToDeployBranch":
          // These are not real errors and also they will happen many times. We just log them locally but not throw an error
          sendToAmazeeioLogs('info', siteGroup.siteGroupName, uuid, `${webhooktype}:${event}:handledButNoTask`, meta,
            `*[${siteGroup.siteGroupName}]* No deploy task created, reason: ${error}`
          )
          return;

        default:
          // Other messages are real errors and should reschedule the message in RabbitMQ in order to try again
          throw error
      }
    }
}
