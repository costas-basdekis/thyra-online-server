const SI_SYMBOL = ["", "k", "M", "G", "T", "P", "E"];

const abbreviateNumber = number => {
    const tier = Math.log10(number) / 3 | 0;
    const suffix = SI_SYMBOL[tier];
    if (!suffix) {
      return number;
    }

    const scale = Math.pow(10, tier * 3);
    const scaled = number / scale;
    return `${scaled.toFixed(1)}${suffix}`;
};

module.exports = {
  abbreviateNumber,
};
