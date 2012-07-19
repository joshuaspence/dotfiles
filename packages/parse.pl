#!/usr/bin/env perl

use strict;
use warnings;

use Getopt::Std;
use Getopt::Long;

################################################################################

use constant {
    CLI_PACKAGE_FILE => "packages.cli",
    GUI_PACKAGE_FILE => "packages.gui"
};

use constant {
    false   =>  0,
    true    =>  1
};

# Forward declarations
sub trim($);
sub ltrim($);
sub rtrim($);

################################################################################

my $package_file = GUI_PACKAGE_FILE;
my %all_packages = ();

# Get command line options
Getopt::Long::Configure('bundling');
my $all_data;
GetOptions('a|all-data' => \$all_data);

# The argument should be the input file
open FILE, "<", $package_file or die $!;

# Parse the data
my $line;
my $new_package = false;
while($line = <FILE>) {
    chomp($line); # remove newline characters
    
    if ($line = "") {
        $new_package = true;
    } else if ($line =~ m/^\s*#/) {
        # This is a header
        # or a comment
        (my $header = $line) =~ s/\s*#\s*//;
        
        print "Header: '$header'\n";
    } else {
        # This is data
        (my $package = $line) =~ s/\s*#.*$//;
        (my $comment = $line) =~ s/^[^#]*(#\s*)?//;
        
        print "Package: '$package'\n";
        print "Comment: '$comment'\n";
    }
}

# Perl trim function to remove whitespace from the start and end of the string
sub trim($) {
    my $string = shift;
    $string =~ s/^\s+//;
    $string =~ s/\s+$//;
    return $string;
}

# Left trim function to remove leading whitespace
sub ltrim($) {
    my $string = shift;
    $string =~ s/^\s+//;
    return $string;
}

# Right trim function to remove trailing whitespace
sub rtrim($) {
    my $string = shift;
    $string =~ s/\s+$//;
    return $string;
}
