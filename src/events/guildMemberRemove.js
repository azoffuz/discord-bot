const logger = require('../utils/logger');
const { updateGuildStats } = require('../utils/statsUpdater');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    await logger.logMemberLeave(member);
    updateGuildStats(member.guild);
  }
};
