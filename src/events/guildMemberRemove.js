const logger = require('../utils/logger');
const { updateGuildStats } = require('../utils/statsUpdater');
const { forgetMember } = require('../utils/activityTracker');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    await logger.logMemberLeave(member);
    // Ochiq ovozli sessiya keshda qolib ketmasin
    forgetMember(member.guild.id, member.id);
    updateGuildStats(member.guild);
  }
};
